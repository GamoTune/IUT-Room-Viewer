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

---

## 2026-09-25 — Étape 4 : conteneuriser le serveur et l'éprouver en CI

### Pourquoi

Jusque-là, le pipeline prouvait que le code **compile** et que les tests **passent**, sur un runner
Ubuntu avec Bun installé par une action. Rien ne prouvait qu'il **démarre** ailleurs que sur le poste
de développement. C'est exactement le « ça marche chez moi » que le cours prend comme exemple
(pages 22 à 25) : environnements différents, dépendances différentes, exceptions aléatoires en
production.

L'image, elle, est un artefact vérifiable : même système, mêmes dépendances, même commande de
démarrage qu'en production.

### Ce qui a été mis en place

- **`server/Dockerfile` multi-étapes.** Une étape `deps` qui n'installe que les dépendances, une
  étape `runtime` qui n'emporte que le nécessaire. Tant que les manifestes ne changent pas, Docker
  réutilise le calque d'installation : le code change cent fois par jour, pas les dépendances.
- **Contexte de construction à la racine** du dépôt, pas dans `server/` : les dépendances d'un espace
  de travail Bun se résolvent depuis `bun.lock`, qui vit à la racine.
- **`--filter=server`** : n'installe que les dépendances de l'API. Sans lui, Vue, le design system et
  discord.js entrent dans l'image du serveur — **186 Mo de dépendances contre 119**.
- **Sans root** (`USER bun`, fourni par l'image de base) et **`HEALTHCHECK`** intégré : le conteneur
  sait dire s'il va bien, l'orchestrateur n'a pas à le deviner.
- **`compose.yaml`** : PostgreSQL + API. La base a son propre test de santé (`pg_isready`) et l'API
  ne démarre qu'une fois la base **réellement prête**, pas seulement lancée.
- **Job `container`** : construit l'image avec le cache GitHub, démarre la pile avec `--wait`,
  applique les migrations, puis interroge `/health` et `/api/v1/rooms`.

### Les quatre échecs, et ce qu'ils apprennent

C'est la partie la plus instructive : **rien n'a marché du premier coup**, et aucun de ces défauts
n'était visible en local.

1. **`COPY web/.npmrc` — fichier introuvable.** Ce fichier déclare la forge privée pour le scope
   `@gamo`… mais il n'est pas suivi par Git : il n'existe que sur mon poste. La CI ne l'a jamais eu.
   Si l'installation marche quand même, c'est que `bun.lock` contient déjà l'URL résolue du paquet.
   **Leçon** : la construction d'image révèle ce que le dépôt ne contient pas vraiment.
2. **`Cannot find module 'dotenv/config'`.** Bun ne remonte pas toutes les dépendances à la racine :
   celles d'un paquet d'espace de travail vivent dans son propre `node_modules`, en liens
   symboliques vers le magasin central. L'image n'emportait que celui de la racine. Reproduit en
   trente secondes hors Docker, en rejouant l'étape `deps` dans un dossier temporaire — plus rapide
   que d'enchaîner les constructions.
3. **`TypeError: undefined is not an object` dans `@PrimaryGeneratedColumn`.** Bun choisit le
   `tsconfig.json` à partir du **répertoire de travail**. Lancé depuis `/app`, il ne trouvait pas
   celui du serveur, compilait avec les décorateurs _standards_ (TC39) au lieu des décorateurs
   historiques de TypeScript, et TypeORM s'effondrait sur la première entité. Corrigé par
   `WORKDIR /app/server`. **Leçon** : le conteneur ne reproduit pas seulement l'OS, il reproduit
   aussi le répertoire depuis lequel on lance — et ça compte.
4. **`Module not found "/app/node_modules/typeorm/cli.js"`** : même histoire de résolution. Corrigé
   en appelant `bun run db:migrate`, le script du dépôt, plutôt qu'un chemin en dur. **Leçon** : la
   CI ne doit pas réinventer les commandes du projet, sinon elles divergent.

### Mesures

|                        |                                                                       |
| ---------------------- | --------------------------------------------------------------------- |
| Taille de l'image      | **236 Mo**                                                            |
| Dépendances embarquées | 119 Mo (au lieu de 186 sans `--filter`)                               |
| Durée du job complet   | **42 s**, construction avec cache comprise                            |
| Migrations appliquées  | 2, sur une base PostgreSQL 18 vierge                                  |
| Vérifications          | `/health` répond `status: ok`, `/api/v1/rooms` répond `success: true` |

À comparer aux autres jobs du même pipeline : lint 14 s, types et tests 17 s, Sonar 60 s.

### Comparatif des approches

| Approche                                                     | Ce qu'elle prouve                                      | Coût                              |
| ------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------- |
| Runner Ubuntu + action `setup-bun` (avant)                   | Le code compile et les tests passent                   | ~15 s                             |
| Job exécuté **dans** un conteneur (`container:` du workflow) | Idem, mais dans l'image cible                          | ~15 s, sans artefact réutilisable |
| **Image construite + pile démarrée** (retenu)                | Le serveur **démarre**, migre une vraie base et répond | 42 s                              |
| Kubernetes / environnement de pré-production                 | Comportement sous charge, montée de version            | Hors sujet pour ce projet         |

L'option intermédiaire, `container:` dans le workflow, est séduisante et pas chère — mais elle ne
produit aucun artefact : on teste _dans_ une image sans jamais vérifier que **la nôtre** fonctionne.
Ici, ce qui est éprouvé est exactement ce qui pourrait partir en production.

### Reste à éprouver

- **Scanner l'image** (Trivy, Grype) : c'est le prolongement naturel, et ça recouvre l'analyse de
  vulnérabilité des dépendances du cours.
- **Publier l'image** dans un registre (`ghcr.io`) sur tag, pour boucler la chaîne jusqu'au
  déploiement.
- **Réduire la taille** : `bun build --compile` produit un binaire autonome, mais `pdfjs-dist`
  résout ses polices par `createRequire`, ce qui casse dans un binaire compilé. À mesurer plutôt
  qu'à supposer.

---

## 2026-09-25 — Étape 5 : le déploiement continu, ou le pipeline fantôme

### Le défaut, d'abord

Le dépôt contenait `.forgejo/workflows/deploy-web.yml` : un déploiement complet du front, déclenché
par un tag `web-v*`. Tout y était — construction, contrôle du bundle, envoi SFTP. Un détail :
c'est un workflow **Forgejo**, et le dépôt vit sur **GitHub**, sans miroir sur la forge.

**Il ne s'est jamais exécuté une seule fois.** Et personne ne l'a remarqué, parce qu'un pipeline qui
ne se déclenche pas n'échoue jamais : aucune croix rouge, aucune notification. C'est le pire état
possible pour une chaîne — on croit être couvert. Pendant ce temps le front partait à la main, par
`bun run deploy`, depuis mon poste, avec mes identifiants dans `~/.netrc`.

Le cours insiste sur la traçabilité et la reproductibilité (pages 4 et 22) : un déploiement manuel
n'a ni l'une ni l'autre. Personne ne sait ce qui est en ligne, ni depuis quand, ni qui l'a envoyé.

### Ce que fait le nouveau workflow

Sur tag `web-v*` :

1. **Contrôle des prérequis avant tout travail.** Un secret oublié se voit en cinq secondes, pas
   après trois minutes de construction.
2. **Le tag doit correspondre** à la version de `web/package.json` : impossible de publier une
   `web-v0.3.0` depuis un paquet resté en `0.2.0`.
3. **Construction** avec `VITE_API_BASE_URL`, puis **contrôle de ce qui va partir** : la racine de
   l'API doit réellement figurer dans le bundle. Sans ce garde-fou, le site déployé interroge sa
   propre origine — c'est exactement la panne qui était arrivée en production en septembre.
4. **Envoi SFTP** en miroir avec suppression. Le mot de passe passe par l'environnement
   (`lftp --env-password`), jamais par la ligne de commande où `ps` le lirait.
5. **Vérification du site en ligne** : le job n'est vert que si `iut.gamo.one` sert bien le nouveau
   bundle. Un envoi partiel ou un cache figé fait échouer le déploiement au lieu de passer inaperçu.

### Livraison ou déploiement ?

Le cours distingue les deux (page 28). Ici c'est bien du **déploiement continu** : l'artefact part
directement en production, sans validation humaine intermédiaire. C'est défendable pour un site
statique consulté par quelques dizaines d'étudiants, où un retour en arrière coûte un tag. Ça ne le
serait pas pour l'API, qui porte une base de données et des migrations : là, il faudrait une étape
d'approbation et un environnement de pré-production.

**Le déclencheur est un tag, pas un push sur `main`.** C'est un choix : tout ce qui est fusionné
n'est pas forcément à mettre en ligne. Le tag est l'acte délibéré de livrer.

### Comparatif : GitHub Actions et Forgejo Actions

J'ai les deux sous la main — le design system est déployé par ma propre forge.

|                    | GitHub Actions                                   | Forgejo Actions (homelab)                           |
| ------------------ | ------------------------------------------------ | --------------------------------------------------- |
| Runners            | Fournis, illimités sur dépôt public              | À héberger : un runner et des workers LXC jetables  |
| Démarrage d'un job | ~5 s                                             | ~20 s, le temps de cloner le conteneur modèle       |
| Syntaxe            | La référence                                     | Compatible, mais toutes les actions ne marchent pas |
| Écosystème         | Toutes les actions du Marketplace                | Les actions GitHub souvent, sinon les siennes       |
| Secrets            | Chiffrés, masqués dans les journaux              | Idem                                                |
| Coût               | Gratuit ici, facturé à la minute sur dépôt privé | L'électricité et le temps de maintenance            |
| Souveraineté       | Aucune : tout passe chez Microsoft               | Totale                                              |

Pour ce projet, GitHub Actions s'impose puisque le code y est déjà. Mais l'expérience de la forge
apprend quelque chose que GitHub cache : **un runner, ça se maintient**. Mises à jour, espace disque,
images de base qui dérivent. Le confort du runner géré a un prix, simplement il n'est pas visible.

### Reste à éprouver

- Faire tourner le workflow pour de vrai : il attend cinq secrets et variables côté dépôt.
- Étendre au serveur : aujourd'hui il tourne sous PM2, mis à jour à la main. L'image construite à
  l'étape 4 est le chaînon manquant — reste à la publier dans un registre et à la faire tirer par le
  serveur.
