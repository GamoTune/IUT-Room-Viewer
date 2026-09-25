# Journal des expérimentations CI/CD

Matière brute pour le rapport de R5.A.07 (Automatisation de la chaîne de production).
Chaque entrée note **pourquoi** l'outil a été choisi, **ce qui a coincé** et **ce qui a été mesuré** —
pas seulement ce qui a été installé.

## Le projet support

**IUT Room Viewer** — monorepo Bun (`server`, `bot`, `web`) qui lit les emplois du temps PDF publiés
par l'IUT, les importe en PostgreSQL et sert une API plus un site (iut.gamo.one). Projet existant,
repris pour le module, déjà en production : les erreurs de chaîne se voient en vrai.

|                     |                                                    |
| ------------------- | -------------------------------------------------- |
| Langage             | TypeScript strict, runtime Bun 1.3.14              |
| Serveur             | Express + TypeORM + PostgreSQL                     |
| Front               | Vue 3 + Vite, fichiers statiques sur mutualisé OVH |
| Hébergement du code | GitHub (`GamoTune/IUT-Room-Viewer`)                |
| Tests               | `bun test`, 322 tests, 94 % de lignes couvertes    |

## État avant le module

- **CI** : un workflow GitHub Actions (`.github/workflows/ci.yml`) sur chaque PR et push sur `main` :
  vérification des types, tests, seuil de couverture, publication du rapport LCOV en artefact.
- **Analyse statique** : SonarCloud analysait bien le dépôt, mais par son **analyse automatique**,
  déclenchée par l'application GitHub — donc _à côté_ du pipeline, sans pouvoir bloquer quoi que ce soit.
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

| Outil                            | Ce qui le distingue                                                             | Pourquoi pas lui ici                                                              |
| -------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **SonarQube Cloud**              | Gratuit sur dépôt public, Quality Gate sur le _nouveau_ code, décoration des PR | _Retenu_                                                                          |
| SonarQube Community auto-hébergé | Mêmes règles, données chez soi                                                  | Un conteneur de plus à maintenir sur le homelab pour le même service              |
| SonarLint (IDE)                  | Retour immédiat pendant la frappe                                               | Ne bloque rien : complémentaire, pas une étape de CI                              |
| CodeClimate / Codacy             | Installation plus simple                                                        | Règles TypeScript moins fines, gratuité moins nette                               |
| ESLint seul                      | Rapide, extensible, hors ligne                                                  | Ne mesure ni couverture, ni duplication, ni dette ; sera l'étape 2, en complément |

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

### Résultats (PR #13)

Deux échecs avant d'y arriver, puis analyse verte.

1. **Organisation inexistante** — `ERROR Organization key 'Arthur Labregere' does not exist.` Le
   fichier de configuration reprenait le nom du compte au lieu des clés SonarCloud. Les bonnes
   valeurs se lisent dans l'API publique :
   `https://sonarcloud.io/api/components/search?organization=gamotune&qualifiers=TRK` →
   organisation `gamotune`, projet `GamoTune_IUT-Room-Viewer`. Leçon : la clé de projet Sonar n'a
   rien à voir avec le nom du dépôt Git, et le message d'erreur ne dit pas où trouver la bonne.
2. Une fois corrigé : **Quality Gate OK**, job en **58 s** contre **14 s** pour le job de tests.
   L'analyse coûte donc environ quatre fois le prix des tests — acceptable ici, à surveiller sur un
   projet plus gros.

**Ce que l'analyse voit du code existant** (`main`, mesuré par l'ancienne analyse automatique) :

| Mesure          | Valeur             |
| --------------- | ------------------ |
| Lignes de code  | 9 063              |
| _Code smells_   | 95                 |
| Dette technique | 754 min (~12 h 30) |
| Duplication     | 0,5 %              |
| Couverture      | _absente_          |

**Ce que l'analyse du pipeline ajoute**, sur la PR : couverture **91,2 %**, 0 bug, 0 vulnérabilité,
0 _code smell_ sur le nouveau code, dette nulle.

Trois enseignements pour le rapport :

- **L'analyse automatique ne voit jamais la couverture.** Elle n'exécute pas les tests et ne reçoit
  aucun rapport LCOV : la ligne « Coverage » restait vide sur `main`. Passer par le pipeline est la
  seule façon d'avoir la couverture _dans_ Sonar. À elle seule, cette différence justifie l'étape.
- **Les 91,2 % de Sonar ne sont pas les 94,04 % mesurés en local.** Même rapport LCOV, mais Sonar
  compte les lignes exécutables à sa façon et applique ses propres exclusions. Deux outils qui
  « mesurent la couverture » ne donnent pas le même chiffre : ce qui compte est de comparer un outil
  à lui-même dans le temps.
- **La Quality Gate par défaut ne juge que le nouveau code** : les quatre conditions portent toutes
  sur `new_*`. Les 95 _code smells_ existants ne bloquent donc rien — c'est volontaire (_clean as you
  code_), mais il faut le savoir : une PR peut passer au vert dans un projet en mauvais état.

### Reste à éprouver

- Ouvrir une PR volontairement mauvaise (fonction dupliquée, code mort, `any`) pour vérifier que la
  porte passe bien au rouge et **bloque** la fusion.
- Regarder ce que valent les 95 _code smells_ existants : dette réelle ou bruit ?

---

## 2026-09-25 — Étape 2 : un linter et un formateur dans la chaîne

### Pourquoi ces outils

Le job de CI s'appelait « Serveur — Type, Lint, Test » et ne lintait rien : le dépôt n'avait ni
linter ni formateur. Deux besoins distincts, qu'on confond souvent :

- **Le formateur** (Prettier) règle la _mise en forme_ : indentation, guillemets, largeur. Aucun
  jugement sur le code, aucune discussion possible en revue.
- **Le linter** (ESLint) cherche des _défauts_ : import mort, variable inutilisée, `let` jamais
  réassigné, promesse oubliée. Ce que ni le compilateur ni les tests ne voient.

`AGENTS.md` fixait déjà le style à la main (4 espaces, 128 colonnes, guillemets doubles) : une
convention écrite que rien ne faisait respecter.

### Comparatif des outils du même type

| Outil                                                | Rôle               | Vitesse sur ce dépôt                       | Verdict                                              |
| ---------------------------------------------------- | ------------------ | ------------------------------------------ | ---------------------------------------------------- |
| **ESLint 9 + typescript-eslint + eslint-plugin-vue** | Lint               | **1,05 s** (139 fichiers)                  | _Retenu_ : seul à comprendre le `<template>` Vue     |
| **Prettier 3**                                       | Format             | **0,76 s**                                 | _Retenu_ : le standard, configuration en huit lignes |
| **Biome 2**                                          | Lint **et** format | **0,12 s** (28 ms de calcul, 110 fichiers) | Écarté ici, voir ci-dessous                          |
| oxlint                                               | Lint               | non mesuré                                 | Même limite que Biome sur Vue                        |

**Biome est 35 fois plus rapide** — et c'est réel, pas du marketing : 28 ms de calcul contre une
seconde. Un seul binaire, là où ESLint en demande six. Mais lancé sur ce dépôt, il signale `Badge`
comme « import inutilisé » dans `FreshnessBadge.vue` : il lit le `<script>` des fichiers Vue et
**ignore le `<template>`**, où le composant est justement utilisé. Un faux positif sur un composant
front, c'est rédhibitoire — un linter en qui on n'a pas confiance finit désactivé. Ses 145
« erreurs » restantes étaient surtout des divergences de mise en forme, Biome utilisant des
tabulations par défaut : la comparaison reste faussée tant qu'on ne lui écrit pas une configuration.

**Conclusion** : ESLint et Prettier ici, parce que le front est en Vue. Sur un projet sans Vue, ou
pour un _hook_ de pré-commit où la seconde compte, Biome mériterait d'être repris.

### Ce que le linter a trouvé, dès le premier passage

16 problèmes, tous réels, sur 12 600 lignes :

- **10 imports morts** (`LessThan`, `MoreThan`, `IsNull`, `Not`, `FindOptionsWhere`… hérités de
  refactorisations), deux captures d'erreur inutilisées, un `let` jamais réassigné, un paramètre mort.
- **Un test qui ne testait pas ce qu'il annonçait** : dans le test des échappements ICS, la chaîne
  `"…fin\; et…"` contenait un `\;` que JavaScript réduit à un simple `;`. Le test vérifiait donc que
  le parseur transforme `;` en `;`. Corrigé en `\;`, il teste enfin l'échappement du format — et il
  passe. C'est le genre de défaut qu'aucune suite de tests ne signale : les tests étaient verts.

Un seul avertissement écarté : `vue/require-default-prop`, pensé pour l'API d'options. En
`script setup` typé, le type dit déjà que la prop est facultative, et la distinction entre « absente »
et « nulle » porte du sens dans ce composant.

### Le formateur, une décision à prendre

`prettier --check` trouvait **75 fichiers sur 150** non conformes. Deux choix :

1. Formater tout, en un commit isolé — un gros diff, mais une fois pour toutes.
2. Formater au fil de l'eau, en n'exigeant le format que sur les fichiers touchés.

**Retenu : tout formater**, dans un commit à part (491 insertions, 631 suppressions, aucun changement
de comportement). La seconde option demande un outil de plus pour ne vérifier que le diff, et laisse
le dépôt à deux régimes pendant des mois. Le commit isolé, lui, se saute à la lecture de l'historique
(`git log --invert-grep`, ou un fichier `.git-blame-ignore-revs`).

### Dans le pipeline

Un job `quality` **sans dépendance**, placé avant les tests : c'est la vérification la moins chère,
elle rend la main en quelques secondes sur une faute de style ou un import mort, sans attendre la
suite. `format:check` et non `format` : la CI **constate**, elle ne réécrit jamais le dépôt — un
pipeline qui committe à votre place est un pipeline qu'on ne relit plus.

Le job de tests a aussi été renommé « Serveur — Types et tests » : il n'a jamais linté, son nom le
prétendait.

### Effet de bord inattendu : le formatage a réveillé Sonar

La PR de l'étape 2 a fait **échouer la Quality Gate** — alors qu'elle ne change aucun comportement.
Explication : Sonar ne juge que le _nouveau_ code, et « nouveau » veut dire _lignes touchées_. Le
passage de Prettier ayant touché 75 fichiers, des centaines de lignes anciennes sont redevenues
neuves aux yeux de l'analyse, dette comprise. Le verdict : `new_reliability_rating` à **D**, à cause
d'un bug jusque-là invisible.

Le bug, dans `tests/sync/importer.spec.ts` :

```ts
// avant — l'assertion part sans que personne ne l'attende
expect(Importer.instance.importLessons(...)).rejects.toThrow("Code de groupe illisible");
```

Une assertion asynchrone non attendue : le test passait **même si l'import ne rejetait rien**. Un
test qui ne pouvait pas échouer, donc un test qui ne servait à rien. Corrigé par un `await`.

Deux leçons pour le rapport :

- Un reformatage massif **coûte une analyse Sonar complète** de tout ce qu'il touche. C'est
  désagréable sur le moment, mais c'est exactement ce qu'on veut : la dette cachée remonte.
- Encore un défaut trouvé **dans les tests**, pas dans le code de production. Deux outils différents
  (ESLint, puis Sonar) ont chacun trouvé un test qui mentait. La suite de tests était verte dans les
  deux cas — la couverture dit combien de lignes sont exécutées, jamais si les assertions tiennent.

Sonar signale par ailleurs six _code smells_ mineurs sur ces mêmes lignes (`replace` au lieu de
`replaceAll`, une complexité cognitive de 18 pour 15 autorisés dans `parseTimetable`). Non corrigés :
ils ne bloquent pas la porte, et les traiter dans cette PR mélangerait deux intentions. Ils sont
notés comme dette.

### Reste à éprouver

- Le gain réel en revue : moins de remarques de style sur les prochaines PR ?
- Brancher ESLint sur le type-checker (`typescript-eslint` en mode _type-aware_) : règles bien plus
  fines (promesses non attendues, comparaisons impossibles), au prix d'une analyse plus lente.
