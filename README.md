# 🏫 IUT Room Viewer

> Visualisez en temps réel la disponibilité des salles du département informatique de l'IUT du Limousin.

[![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)](https://github.com/GamoTune/IUT-Room-Viewer)
[![Bun](https://img.shields.io/badge/Bun-1.0+-black.svg)](https://bun.sh)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2.svg)](https://discord.js.org)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748.svg)](https://prisma.io)

---

## 📋 Description

IUT Room Viewer est une application complète combinant :
- **Une API REST** pour récupérer les données de disponibilité des salles
- **Un bot Discord** pour consulter ces informations facilement
- **Un système de synchronisation automatique** des emplois du temps

---

## 🚀 Utilisation rapide

### 🤖 Bot Discord

| Type | Lien |
|------|------|
| **Bot pour serveurs** | [Ajouter Salles IUT](https://discord.com/oauth2/authorize?client_id=1331626843257966613&permissions=2147485696&integration_type=0&scope=bot) |
| **Intégration utilisateur** | [IUT-Room-viewer](https://discord.com/oauth2/authorize?client_id=1331626843257966613) |

### 💬 Commandes Discord

| Commande | Description |
|----------|-------------|
| `/help` | Affiche l'aide sur les commandes disponibles |
| `/salles_maintenant` | Affiche l'état actuel de toutes les salles |
| `/salles_entre` | Affiche l'état des salles entre deux horaires |

#### Options de `/salles_entre`

| Option | Type | Requis | Description |
|--------|------|--------|-------------|
| `heure_début` | Entier | ✅ | Heure de début |
| `heure_fin` | Entier | ✅ | Heure de fin |
| `minute_debut` | Entier | ❌ | Minute de début (défaut: 0) |
| `minute_fin` | Entier | ❌ | Minute de fin (défaut: 0) |
| `jour` | Entier | ❌ | Jour (défaut: aujourd'hui) |
| `mois` | Entier | ❌ | Mois (défaut: mois actuel) |
| `année` | Entier | ❌ | Année (défaut: année actuelle) |

---

## 🌐 API REST

L'API REST permet d'accéder aux données des salles de manière programmatique.

### Endpoints disponibles

#### 📍 Informations générales

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/` | Informations sur l'API (version, endpoints) |
| `GET` | `/health` | Vérification de l'état du serveur |

#### 🏠 Salles

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/v1/rooms` | Liste toutes les salles |
| `GET` | `/api/v1/rooms/availability` | Disponibilité des salles sur une plage horaire |

**Paramètres de `/api/v1/rooms/availability` :**

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `startTime` | ISO 8601 | ✅ | Date/heure de début |
| `endTime` | ISO 8601 | ✅ | Date/heure de fin |

**Exemple :**
```bash
GET /api/v1/rooms/availability?startTime=2025-01-04T08:00:00&endTime=2025-01-04T12:00:00
```

#### 🔄 Synchronisation

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| `GET` | `/api/v1/sync/status` | ❌ | Statut de la dernière synchronisation |
| `POST` | `/api/v1/sync/trigger` | 🔐 | Déclenche une synchronisation manuelle |
| `POST` | `/api/v1/sync/reset` | 🔐 | Réinitialise et resynchronise les données |

> 🔐 Les routes protégées nécessitent une clé API via le header `X-API-Key`

### Format de réponse

```json
{
  "success": true,
  "data": [...]
}
```

En cas d'erreur :
```json
{
  "success": false,
  "error": "Message d'erreur"
}
```

---

## 🛠️ Installation

### Prérequis

- [Bun](https://bun.sh) (v1.0+)
- [MariaDB](https://mariadb.org/) ou MySQL
- Compte développeur Discord

### Installation

```bash
# Cloner le repository
git clone https://github.com/GamoTune/IUT-Room-Viewer.git
cd IUT-Room-Viewer

# Installer les dépendances (workspaces)
bun install

# Générer les clients Prisma
bun run generate
```

### Configuration

Créez un fichier `.env` dans chaque sous-projet :

#### `server/.env`
```env
# Base de données EDT
DATABASE_URL_EDT="mysql://user:password@localhost:3306/iut_edt"

# Base de données Stats
DATABASE_URL_STATS="mysql://user:password@localhost:3306/iut_stats"

# API
PORT=3000
API_KEY="votre-cle-api-secrete"
VERSION="4.0.0"
```

#### `bot/.env`
```env
TOKEN="votre-token-discord-bot"
CLIENT_ID="id-de-votre-application-discord"
VERSION="4.0.0"
API_URL="http://localhost:3000"
```

### Lancement

#### Développement
```bash
# Lancer les deux services en mode watch
bun run dev

# Ou séparément
bun run dev:server
bun run dev:bot
```

#### Production
```bash
# Lancer les deux services
bun run start

# Ou avec PM2
pm2 start ecosystem.config.js
```

---

## 📁 Structure du projet

```
IUT-Room-Viewer/
├── 📂 bot/                      # Bot Discord (TypeScript)
│   ├── 📂 src/
│   │   ├── 📂 commands/         # Commandes slash
│   │   ├── 📂 events/           # Gestionnaires d'événements
│   │   ├── 📂 services/         # Services (API, logging)
│   │   ├── 📂 types/            # Types TypeScript
│   │   ├── 📂 utils/            # Utilitaires
│   │   └── 📄 index.ts          # Point d'entrée
│   └── 📄 package.json
│
├── 📂 server/                   # Serveur API (TypeScript)
│   ├── 📂 src/
│   │   ├── 📂 api/              # Configuration Express
│   │   │   └── 📂 routes/       # Définition des routes
│   │   ├── 📂 controllers/      # Contrôleurs HTTP
│   │   ├── 📂 services/         # Logique métier
│   │   ├── 📂 repository/       # Accès aux données
│   │   ├── 📂 middleware/       # Middlewares (auth, etc.)
│   │   ├── 📂 sync/             # Synchronisation EDT
│   │   ├── 📂 types/            # Types TypeScript
│   │   └── 📄 index.ts          # Point d'entrée
│   ├── 📂 prisma/               # Schémas de base de données
│   │   ├── 📂 edt/              # Base EDT
│   │   └── 📂 stats/            # Base Stats
│   └── 📄 package.json
│
├── 📄 ecosystem.config.js       # Configuration PM2
└── 📄 package.json              # Workspace root
```

---

## 🔧 Technologies

| Catégorie | Technologies |
|-----------|--------------|
| **Runtime** | Bun |
| **Langage** | TypeScript |
| **API** | Express |
| **Base de données** | MariaDB/MySQL, Prisma ORM |
| **Bot** | Discord.js v14 |
| **Données EDT** | [unilim](https://www.npmjs.com/package/unilim) |
| **Planification** | node-cron |
| **Production** | PM2 |

---

## ✨ Fonctionnalités

- 🔄 **Synchronisation automatique** des emplois du temps (toutes les heures)
- 🏢 **Gestion intelligente des salles** (amphithéâtres, plages de salles)
- 📊 **Organisation par étages** dans l'affichage Discord
- 🎯 **API REST complète** pour intégrations tierces
- 📈 **Statistiques d'utilisation** (base de données dédiée)

---

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- 🐛 Signaler des bugs
- 💡 Proposer des améliorations
- 🔧 Soumettre des pull requests

---

## 📄 Licence

Ce projet est sous licence libre.

---

<p align="center">
  <i>Développé avec ❤️ pour les étudiants d'informatique de l'IUT Limousin</i>
</p>