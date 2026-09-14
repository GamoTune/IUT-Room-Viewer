# Conventions du dépôt — IUT Room Viewer

Ce fichier fait autorité sur les conventions générales. Il ne répète pas ce qui se lit
directement dans le code : il fixe les points qui se rejouent à chaque session.

## Stack

| Élément | Choix |
| --- | --- |
| Runtime | Bun — jamais `npm`, `npx`, `yarn`, `pnpm` |
| Langage | TypeScript strict |
| API | Express |
| ORM | **TypeORM** |
| Base | **PostgreSQL** (prod : LXC 101, `10.0.1.240:5432`) |
| Bot | discord.js v14 |
| Production | PM2, LXC 102 « prod » de bigboy |

Workspaces Bun : `server/` et `bot/`. Le lockfile est `bun.lock`.

## Source des emplois du temps

La source qui fait foi est le **PDF d'année** publié sur `edt-iut-info.unilim.fr`
(`/edt/A1/A1_S<n>.pdf`, idem A2 et A3), lu par un parseur maison.

- `S<n>` désigne la **semaine** depuis la rentrée, pas le semestre.
- Les fichiers `.ics` du même serveur sont **inutilisables** : ils proviennent du système de
  l'université, que le département n'utilise pas, et ne reflètent que des réservations de salles
  incomplètes. Le code qui les lit (`server/src/sync/ics/`) est conservé en veille, débranché de
  l'import, au cas où l'IUT les corrigerait.
- La bibliothèque npm `unilim` n'est plus maintenue et son dépôt a disparu : ne pas en dépendre.

## Architecture du serveur

```
server/src/
  api/           routes Express, fines : elles délèguent au controller
  controllers/   xxx.controller.ts  — validation des entrées et des droits
  services/      xxx.service.ts     — logique métier
  repository/    xxx.repository.ts  — accès aux données (TypeORM)
  entities/      xxx.entity.ts      — entités TypeORM
  types/         types et interfaces partagés
  sync/          récupération et interprétation des EDT
  cli/           commandes lancées à la main
tests/           miroir de src/
```

**Sens de dépendance :** `api → controller → service → repository → TypeORM`. Jamais l'inverse,
jamais de saut de couche. Seule exception : un controller peut appeler un repository pour charger
les données strictement nécessaires au contrôle des droits.

| Couche | Ne fait jamais |
| --- | --- |
| `api` | contenir de la logique |
| `controller` | calcul métier, accès aux données |
| `service` | lire la requête HTTP, accès aux données |
| `repository` | logique métier, contrôle de droits |

- **Controllers et repositories sont des singletons**, exposés par une propriété statique publique :
  `public static instance: RoomController = new RoomController();`. Pas de `getInstance()`.
- **Le service est instancié dans la méthode du controller** (`const service = new RoomService()`),
  sans état partagé.
- **Ordre imposé dans une méthode de controller :** 1) récupérer les données (params, query, body)
  → 2) tester les données et les droits, en early return → 3) appeler le service avec des données
  déjà validées → 4) renvoyer, mise en forme HTTP minimale.

## Style

- **Commentaires et JSDoc en français** dans ce dépôt (le reste du code l'est déjà).
- 4 espaces, 128 colonnes, guillemets doubles, point-virgule, virgule finale, fins de ligne `lf`.
- Imports en `.js` dans les chemins relatifs (`moduleResolution: NodeNext`).
- Nommage : `featureName.controller.ts` / `.service.ts` / `.repository.ts` / `.entity.ts`,
  `camelCase.ts` pour les utilitaires. Noms au singulier.
- Jamais de `any` : `unknown` puis narrowing explicite. Narrowing à toutes les frontières externes
  (query, body, réponses d'API, fichiers distants).
- Toutes les promesses sont attendues ou gérées ; aucun `catch` vide ; early returns plutôt
  qu'imbrications ; `const` par défaut.
- Zéro erreur de `tsc --noEmit`.
- Une classe = une responsabilité, un fichier = une classe, une fonction = une chose. Au-delà de
  ~50 lignes, découper : une méthode publique se lit de haut en bas, les détails partent en privé.

## Contrat de l'API

Le bot Discord consomme ces routes : leurs formes de réponse ne changent pas sans adapter le bot.

| Route | Réponse |
| --- | --- |
| `GET /api/v1/rooms` | `{ id, name, … }[]` |
| `GET /api/v1/rooms/availability` | salles avec leurs cours sur la période |
| `GET /api/v1/schedule` | EDT d'un groupe pour une date |
| `GET /api/v2/courses` | cours filtrés par groupe, salle, enseignant |

Les groupes sont exposés au niveau réellement concerné : promo entière → `mainGroup` négatif
(`-1` = A1), groupe entier → `subGroup: -1`, sous-groupe → `subGroup: 1` (A) ou `2` (B).
Voir `MAIN_GROUP_CODES` dans `bot/src/utils/format.ts`.

**Enseignants :** les documents désignent un enseignant tantôt par un nom (`Onete C.`), tantôt par
un code (`CO`), sans correspondance fiable. Chaque forme est enregistrée telle quelle, créée
automatiquement, et aucun rapprochement n'est tenté. Une recherche peut porter sur plusieurs formes
et en réunir les résultats.

## Commandes

```bash
bun install
bun run dev            # serveur + bot
bun --filter server dev
bun run sync           # synchronisation manuelle des EDT
bun run sync --dry-run # analyse sans écriture
```

## Discipline

- Le plus petit changement qui résout la tâche ; une intention par commit.
- Types mis à jour dans le même commit que le changement de comportement.
- Ne jamais reformater ni réordonner du code hors sujet.
- **Aucun `git push` ni PR sans accord explicite.**
