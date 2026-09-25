# 🏫 IUT Room Viewer

> Quelles salles sont libres, maintenant, au département informatique de l'IUT du Limousin.

[![Bun](https://img.shields.io/badge/Bun-1.x-black.svg)](https://bun.sh)
[![TypeORM](https://img.shields.io/badge/TypeORM-1.x-fe0803.svg)](https://typeorm.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791.svg)](https://www.postgresql.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2.svg)](https://discord.js.org)

Trois façons de consulter la même donnée :

|                    |                                                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🌐 **Site**        | [iut.gamo.one](https://iut.gamo.one) — salles libres et emplois du temps                                                                                                                                                                        |
| 🤖 **Bot Discord** | [Ajouter au serveur](https://discord.com/oauth2/authorize?client_id=1331626843257966613&permissions=2147485696&integration_type=0&scope=bot) · [en intégration personnelle](https://discord.com/oauth2/authorize?client_id=1331626843257966613) |
| 🔌 **API REST**    | [`/docs`](https://iut-room-viewer.gamo.one/docs) — ouverte, sans authentification                                                                                                                                                               |

---

## D'où viennent les données

Des emplois du temps **de promotion** publiés en PDF par l'IUT (`A1_S1.pdf`), relus
toutes les dix minutes. Ils sont lus directement : positions du texte, traits et
cases peintes, sans dépendance à un service tiers.

**Les autres sources publiées par l'IUT ne sont pas exploitées.** Les fichiers par
groupe et les `.ics` contiennent des attributions de groupe fausses et des cours
manquants — vérifié à plusieurs reprises contre la réalité du terrain. Ils sont
tout de même téléchargés et archivés une fois par jour, pour constater le jour où
l'IUT les corrigera.

Conséquence à connaître : les documents n'écrivent pas le type de séance. Il est
déduit de la portée de la case — un cours couvrant toute une promotion est un CM,
un groupe entier un TD, un demi-groupe un TP. Les SAÉ se reconnaissent au préfixe
de leur code (`S5A.01`).

---

## 🔌 API REST

Base : `https://iut-room-viewer.gamo.one` · Documentation interactive :
[`/docs/v1`](https://iut-room-viewer.gamo.one/docs/v1) et
[`/docs/v2`](https://iut-room-viewer.gamo.one/docs/v2).

**La lecture est libre**, sans clé ni quota. Toutes les dates sont en UTC (`Z`) ;
les emplois du temps sont publiés en heure de Paris et convertis à la lecture,
changements d'heure compris.

### Les routes

| Méthode | Route                        | Clé | Ce qu'elle rend                                     |
| ------- | ---------------------------- | :-: | --------------------------------------------------- |
| `GET`   | `/health`                    |     | État du service                                     |
| `GET`   | `/api/v1/rooms`              |     | Le référentiel des salles                           |
| `GET`   | `/api/v1/rooms/availability` |     | Les salles **et** ce qui les occupe sur une période |
| `GET`   | `/api/v1/groups`             |     | Les groupes publiés par l'IUT                       |
| `GET`   | `/api/v1/schedule`           |     | L'emploi du temps d'un groupe, pour une journée     |
| `GET`   | `/api/v2/courses`            |     | Les cours d'une période, filtrables                 |
| `GET`   | `/api/v1/sync/status`        |     | Où en est la synchronisation                        |
| `POST`  | `/api/v1/sync/trigger`       | 🔐  | Déclenche une synchronisation                       |
| `POST`  | `/api/v1/sync/reset`         | 🔐  | Reprend tout, en ignorant le cache                  |
| `POST`  | `/api/v1/stats/log`          | 🔐  | Journalise une commande du bot                      |

🔐 En-tête `X-API-Key`. Ces routes écrivent : elles ne servent pas à consulter.

### Quelles salles sont libres maintenant

`availability` rend **toutes** les salles, y compris libres — une salle sans cours
porte une liste `lessons` vide. Un instant se demande en donnant deux fois la même
date :

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
curl -s "https://iut-room-viewer.gamo.one/api/v1/rooms/availability?startTime=$NOW&endTime=$NOW" \
  | jq -r '.data[] | select(.lessons | length == 0) | .name'
```

Sur une vraie plage, un cours est retenu dès qu'il la chevauche : les salles dont
`lessons` reste vide sont donc libres sur **toute** la plage.

> `R46` et `R47` sont physiquement les mêmes locaux : un cours dans l'une occupe
> l'autre. L'API les rend séparément, au client de les fusionner.

### L'emploi du temps d'un groupe

```bash
curl -s "https://iut-room-viewer.gamo.one/api/v2/courses\
?start_at=2026-09-07T00:00:00.000Z\
&end_at=2026-09-14T00:00:00.000Z\
&groups=G8a" | jq '.data[0]'
```

```json
{
  "code": "R5A.14",
  "title": "Anglais",
  "type": "TP",
  "rooms": ["R52"],
  "groups": ["G8A"],
  "teacher": "JP",
  "start_at": "2026-09-10T09:30:00.000Z",
  "end_at": "2026-09-10T11:30:00.000Z"
}
```

Trois choses à savoir :

- **Ne codez pas les groupes en dur** : `/api/v1/groups` les liste, et ils changent
  d'une année à l'autre.
- Un filtre `groups` rend aussi les cours de niveau supérieur — demander `G8a`
  retourne ses TP, les TD de `G8` et les CM de sa promotion.
- La fenêtre retient les cours **entièrement contenus** : demandez la semaine
  plutôt que la journée pour ne rien manquer aux bords.

### v1 ou v2 ?

La v1 rend les cours _par salle_, avec des groupes numériques
(`{ mainGroup: -1, subGroup: -1 }` pour une promotion) qu'il faut savoir lire. La
v2 rend une liste de cours déjà lisibles. **Pour afficher un emploi du temps,
prenez la v2** ; pour l'occupation des salles, la v1 est la seule.

Les deux répondent sous la même enveloppe :

```json
{ "success": true, "data": [] }
{ "success": false, "error": "Les paramètres start_at et end_at sont requis" }
```

---

## 🤖 Commandes Discord

| Commande             | Description                             |
| -------------------- | --------------------------------------- |
| `/help`              | L'aide                                  |
| `/salles_maintenant` | L'état de toutes les salles à l'instant |
| `/salles_entre`      | L'état des salles entre deux horaires   |
| `/edt_prof`          | Les cours d'un enseignant               |

`/salles_entre` prend `heure_début` et `heure_fin` (obligatoires), plus
`minute_debut`, `minute_fin`, `jour`, `mois` et `année` pour viser un autre moment
qu'aujourd'hui.

`/edt_prof` demande le nom **et** le code de l'enseignant (`Thomas Hugel` et `TH`) :
les documents de l'IUT emploient les deux sans lien entre eux, l'API réunit ce qui
correspond.

---

## 🛠️ Installation

### Prérequis

- [Bun](https://bun.sh) 1.x
- [PostgreSQL](https://www.postgresql.org) 16+
- Une application Discord, pour le bot

```bash
git clone https://github.com/GamoTune/IUT-Room-Viewer.git
cd IUT-Room-Viewer
bun install
```

### Base de données

Une seule base pour tout le projet :

```sql
CREATE ROLE iut_room_viewer WITH LOGIN PASSWORD 'un-mot-de-passe';
CREATE DATABASE iut_room_viewer OWNER iut_room_viewer;
```

### Configuration

Chaque paquet a son modèle, à copier et renseigner :

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env          # facultatif en développement
```

`server/.env` demande au minimum `DATABASE_URL` et `API_SECRET_KEY`. Pour le bot,
créer `bot/.env` :

```env
TOKEN="le-jeton-du-bot"
CLIENT_ID="l-identifiant-de-l-application"
API_URL="http://localhost:3010"
```

### Premier démarrage

L'ordre compte : le schéma, puis le référentiel des salles, puis les cours.

```bash
bun --filter server db:migrate    # crée le schéma
bun --filter server db:seed       # alimente le référentiel des salles
bun --filter server sync --force  # lit les documents de l'IUT
```

Le seed n'est pas optionnel : les salles ne sont jamais créées depuis un emploi du
temps. Sans lui, les cours sont importés **sans salle**.

### Lancement

```bash
bun run dev          # serveur, bot et site en mode surveillé
bun run dev:server   # ou séparément
bun run dev:bot
bun run dev:web
```

En production, `bun run start`, ou PM2 via `ecosystem.config.js`.

---

## 📁 Structure

```
IUT-Room-Viewer/
├── server/              API REST, lecture des PDF, base de données
│   ├── src/
│   │   ├── api/         Express : routes, documentation OpenAPI
│   │   ├── controllers/ Contrôle des entrées et des droits
│   │   ├── services/    Logique métier
│   │   ├── repository/  Accès aux données (TypeORM)
│   │   ├── entities/    Le schéma
│   │   ├── migrations/  Son évolution
│   │   └── sync/        Découverte, téléchargement, lecture des PDF, import
│   ├── tests/           Miroir de src/
│   └── scripts/         Seuil de couverture
│
├── bot/                 Bot Discord (discord.js v14)
├── web/                 Site (Vue 3, Vite, @gamo/ds)
└── ecosystem.config.js  PM2
```

Le sens de dépendance est `api → controller → service → repository → TypeORM`,
sans saut de couche. Les conventions du dépôt sont dans [AGENTS.md](AGENTS.md).

---

## ✅ Tests

```bash
bun --filter server test        # 280 tests
bun --filter server coverage    # avec le seuil de couverture
```

Le front n'est pas testé. La couverture est mesurée en lignes : `bun test`
n'instrumente pas les branches.

---

## 🔧 Technologies

|                     |                                                 |
| ------------------- | ----------------------------------------------- |
| **Runtime**         | Bun, TypeScript strict                          |
| **API**             | Express, OpenAPI (Swagger UI)                   |
| **Base**            | PostgreSQL, TypeORM                             |
| **Lecture des PDF** | pdfjs-dist                                      |
| **Bot**             | discord.js v14                                  |
| **Site**            | Vue 3, Vite, [@gamo/ds](https://forge.gamo.one) |
| **Planification**   | node-cron                                       |
| **Production**      | PM2                                             |

---

## 🤝 Contribution

Les contributions sont bienvenues : signalez un bug, proposez une amélioration,
ouvrez une pull request. Si vous branchez quelque chose sur l'API, dites-le —
c'est utile de savoir qui en dépend avant de la faire évoluer.

---

## 📄 Licence

Projet sous licence libre.

---

<p align="center">
  <i>Développé pour les étudiants d'informatique de l'IUT du Limousin</i>
</p>
