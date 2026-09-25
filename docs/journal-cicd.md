# Journal des expérimentations CI/CD

Matière brute pour le rapport de R5.A.07 (Automatisation de la chaîne de production).
Chaque entrée note **pourquoi** l'outil a été choisi, **ce qui a coincé** et **ce qui a été mesuré** —
pas seulement ce qui a été installé.

## Le projet support

**IUT Room Viewer** — monorepo Bun (`server`, `bot`, `web`) qui lit les emplois du temps PDF publiés
par l'IUT, les importe en PostgreSQL et sert une API plus un site (iut.gamo.one). Projet existant,
repris pour le module, déjà en production : les erreurs de chaîne se voient en vrai.

| | |
|---|---|
| Langage | TypeScript strict, runtime Bun 1.3.14 |
| Serveur | Express + TypeORM + PostgreSQL |
| Front | Vue 3 + Vite, fichiers statiques sur mutualisé OVH |
| Hébergement du code | GitHub (`GamoTune/IUT-Room-Viewer`) |
| Tests | `bun test`, 322 tests, 94 % de lignes couvertes |

## État avant le module

- **CI** : un workflow GitHub Actions (`.github/workflows/ci.yml`) sur chaque PR et push sur `main` :
  vérification des types, tests, seuil de couverture, publication du rapport LCOV en artefact.
- **Analyse statique** : SonarCloud analysait bien le dépôt, mais par son **analyse automatique**,
  déclenchée par l'application GitHub — donc *à côté* du pipeline, sans pouvoir bloquer quoi que ce soit.
- **Ni linter, ni formateur, ni scan de dépendances, ni conteneur** dans la chaîne.
- **CD** : déploiement du front à la main (`bun run deploy`, mirror SFTP par lftp). Un workflow de
  déploiement existe mais il est écrit pour Forgejo alors que le dépôt vit sur GitHub : il ne s'exécute
  jamais.

---

## 2026-09-25 — Étape 1 : faire entrer SonarQube Cloud dans le pipeline

### Pourquoi cet outil

L'analyse statique est la seule brique du cours qui trouve des défauts qu'aucun test ne trouve :
code mort, complexité, duplication, mauvaises pratiques, vulnérabilités. Sonar est aussi le seul
outil du cours qui agrège **couverture + qualité + sécurité** derrière une seule décision : la
Quality Gate.

Le point qui m'intéresse n'est pas « avoir du Sonar » — il tournait déjà — mais **qui décide**.
Avec l'analyse automatique, le résultat s'affiche sur la PR sans jamais l'empêcher d'être fusionnée :
c'est un tableau de bord. Dans le pipeline, avec `sonar.qualitygate.wait=true`, le job échoue et la PR
est bloquée : c'est une barrière. Toute la différence entre mesurer et tenir une exigence.

### Comparatif rapide des outils du même type

| Outil | Ce qui le distingue | Pourquoi pas lui ici |
|---|---|---|
| **SonarQube Cloud** | Gratuit sur dépôt public, Quality Gate sur le *nouveau* code, décoration des PR | *Retenu* |
| SonarQube Community auto-hébergé | Mêmes règles, données chez soi | Un conteneur de plus à maintenir sur le homelab pour le même service |
| SonarLint (IDE) | Retour immédiat pendant la frappe | Ne bloque rien : complémentaire, pas une étape de CI |
| CodeClimate / Codacy | Installation plus simple | Règles TypeScript moins fines, gratuité moins nette |
| ESLint seul | Rapide, extensible, hors ligne | Ne mesure ni couverture, ni duplication, ni dette ; sera l'étape 2, en complément |

### Mise en place

- Un job `sonar` séparé, qui **dépend du job de tests** (`needs: server`) : sans tests verts, il n'y a
  pas de rapport de couverture, et analyser sans couverture n'aurait pas de sens.
- La couverture ne se recalcule pas : elle transite par l'**artefact** publié par le premier job
  (`upload-artifact` → `download-artifact`). Deux jobs = deux machines, rien n'est partagé sans ça.
- `fetch-depth: 0` : sans l'historique complet, Sonar ne sait pas distinguer le nouveau code de
  l'ancien, et la Quality Gate « on New Code » perd son sens.
- Configuration dans `server/sonar-project.properties`, avec les mêmes exclusions de couverture que
  `bunfig.toml`, pour que `bun run coverage` et Sonar parlent du même périmètre.
- `sonar.qualitygate.wait=true` : le job attend le verdict et échoue si la porte est rouge.

### Ce qui a coincé

- **Analyse automatique vs analyse CI** : les deux ne cohabitent pas. Tant que l'analyse automatique
  reste activée côté SonarCloud, l'analyse lancée par le pipeline est refusée. Il faut la couper
  explicitement (Administration → Analysis Method). C'est le genre de détail qui ne s'invente pas et
  qui coûte une demi-heure.
- **Bun ne mesure pas les branches** : le rapport LCOV produit contient 1 997 lignes `DA:` (lignes) et
  **0 ligne `BRDA:`** (branches). Sonar affiche donc une couverture de conditions vide, et sa
  « Coverage » globale est plus basse que les 94 % de lignes mesurés en local. Ce n'est pas un défaut
  de Sonar mais du runner de tests : `bun test --coverage` n'instrumente pas les branches, et
  `coverageThreshold` de `bunfig.toml` n'était déjà pas appliqué — d'où le script maison
  `scripts/coverage.ts` qui calcule un seuil pondéré à partir du LCOV.
- **Le secret** : `SONAR_TOKEN` doit exister côté dépôt ; sans lui le job échoue tout de suite. Le
  contrôle est fait en début de job pour éviter de payer une analyse inutile.

### À mesurer une fois en place

- Durée du job Sonar, comparée aux ~15 s du job de tests.
- Ce que la Quality Gate remonte sur du code déjà écrit (dette, duplications, *code smells*).
- Est-ce qu'une PR volontairement mauvaise est bien bloquée ? (test à faire : dupliquer une fonction,
  laisser du code mort.)
