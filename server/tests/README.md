# Tests du serveur

```bash
bun test              # toute la suite
bun test --watch      # en continu
bun test tests/services   # un dossier, un fichier…
```

Prérequis : les clients Prisma doivent avoir été générés au moins une fois
(`bun run generate`), les types du serveur en dépendent.

## Ce qui est couvert

| Couche | Fichiers |
| --- | --- |
| Repositories | `tests/repository/` — traduction des filtres en requêtes Prisma |
| Services | `tests/services/` — logique métier (résolution des profs, déduction de l'année, bilan de sync…) |
| Contrôleurs | `tests/controllers/` — codes HTTP, validation des paramètres, format de réponse |

## Comment les dépendances sont neutralisées

Aucun test ne touche une base de données. `tests/setup.ts`, préchargé par
`bunfig.toml`, remplace au démarrage :

- `src/lib/prismaEDT.ts` et `src/lib/prismaSTATS.ts` par les faux clients de
  `tests/helpers/prisma-mock.ts` (ces modules ouvrent une connexion dès leur
  import) ;
- `src/db/client.ts` (client Drizzle de la nouvelle base PostgreSQL) ;
- `unilim/iut/cs/timetable`, qui va chercher les EDT publiés par l'IUT.

Les tests pilotent ensuite les mocks Prisma :

```ts
prismaEdtMock.lesson.findMany.mockResolvedValue([lessonFull()]);
```

`resetPrismaMocks()` — à appeler dans un `beforeEach` — rend des mocks neufs.

## Où se situe la frontière de test

- Contrôleurs et services **exposés en classes** (`courses`, `rooms`, `sync`) :
  la couche du dessous est remplacée par `spyOn`, chaque couche est testée seule.
- Contrôleurs et services **exposés en fonctions de module** (`schedule`,
  `stats`) : ils ne sont pas espionnables, et `mock.module` fuit d'un fichier de
  test à l'autre (un même processus les exécute tous). Ces tests traversent donc
  contrôleur → service → repository, en s'arrêtant au client Prisma.

Corollaire : ne pas appeler `mock.module` depuis un fichier de test. Les
substitutions globales appartiennent à `tests/setup.ts`.
