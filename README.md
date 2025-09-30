# 🏫 IUT Room Viewer

## 📋 Description

IUT Room Viewer est une application Discord permettant de visualiser en temps réel le status des salles du département informatique de l'IUT du Limousin. Le projet combine un système de récupération automatique des données d'emploi du temps avec un bot Discord pour consulter ces informations.

## ✨ Fonctionnalités

### 🔄 Système de données en temps réel
- **Récupération automatique** des emplois du temps avec le module [edt-iut-info-limoges](https://www.npmjs.com/package/edt-iut-info-limoges)
- **Base de données** avec Prisma ORM et MariaDB pour un stockage structuré
- **Mise à jour périodique** des données pour garantir leur fraîcheur (toutes les heures)
- **Gestion intelligente des salles** (amphithéâtres, salles à plages, etc.)

### 🤖 Bot Discord
- **Commandes slash** modernes et pratiques
- **Visualisation en temps réel** de l'état des salles
- **Recherche par plage horaire** personnalisable
- **Organisation par étages** pour une navigation facilitée
- **Intégration serveur ou client** Discord

### 🏗️ Architecture technique
- **Serveur de données** (`server/`) : Récupération et traitement des emplois du temps
- **Bot Discord** (`bot/`) : Interface utilisateur et commandes
- **Base de données relationnelle** : Stockage optimisé avec relations (professeurs, salles, matières, groupes)
- **Configuration PM2** pour la production

## 🚀 Utilisation rapide

### Discord
- **Bot pour serveurs** : [Ajouter Salles IUT](https://discord.com/oauth2/authorize?client_id=1331626843257966613&permissions=2147485696&integration_type=0&scope=bot)
- **Intégration utilisateur** : [IUT-Room-viewer](https://discord.com/oauth2/authorize?client_id=1331626843257966613)

### Commandes disponibles
- `/salles_maintenant` - État actuel de toutes les salles
- `/salles_entre` - État des salles dans une plage horaire

## 🛠️ Installation et configuration

### Prérequis
- [Node.js](https://nodejs.org/) (v22+ recommandé)
- [MySQL](https://www.mysql.com/) ou MariaDB
- Compte développeur Discord

### Installation
1. **Clonez le repository**
   ```bash
   git clone https://github.com/GamoTune/IUT-Room-Viewer.git
   cd IUT-Room-Viewer
   ```

2. **Installez les dépendances**
   ```bash
   npm install
   ```

3. **Configuration de la base de données**
   ```bash
   # Générer le client Prisma
   npx prisma generate
   
   # Appliquer les migrations
   npx prisma db push
   ```

### Configuration

1. **Créez votre application Discord**
   - Rendez-vous sur le [portail développeur Discord](https://discord.com/developers/applications)
   - Créez une nouvelle application et récupérez le token + client ID

2. **Variables d'environnement**
   
   Créez un fichier `.env` à la racine :
   ```env
   # Discord
   TOKEN="votre-token-discord-bot"
   CLIENT_ID="id-de-votre-application-discord"
   VERSION="X.X.X"
   
   # Base de données
   DATABASE_URL="mysql://utilisateur:motdepasse@localhost:3306/iut_room_viewer"
   ```

### Lancement

#### Développement
```bash
# Serveur de données
node server/app.js

# Bot Discord (dans un autre terminal)
node bot/index.js
```

#### Production avec PM2
```bash
# Installer PM2 globalement
npm install -g pm2

# Lancer les deux services
pm2 start ecosystem.config.js

# Monitoring
pm2 status
pm2 logs
```

## 📁 Structure du projet

```
IUT-Room-Viewer/
├── 📂 bot/                    # Bot Discord
│   ├── 📂 commands/           # Commandes slash
│   ├── 📂 events/            # Gestionnaires d'événements
│   ├── 📄 ask.js             # Requêtes base de données
│   ├── 📄 create_fields.js   # Formatage pour Discord
│   └── 📄 index.js           # Point d'entrée du bot
├── 📂 server/                 # Serveur de données
│   ├── 📄 app.js             # Serveur principal
│   └── 📄 fetch_and_save.js  # Récupération et sauvegarde
├── 📂 prisma/                 # Schéma base de données
├── 📄 ecosystem.config.js     # Configuration PM2
├── 📄 package.json           # Dépendances
└── 📄 .env.example          # Exemple de configuration
```

## 🔧 Technologies utilisées

- **Backend** : Node.js, Prisma ORM
- **Base de données** : MariaDB/MySQL
- **Bot** : Discord.js v14
- **API externe** : edt-iut-info-limoges
- **Production** : PM2, dotenv
- **Utilitaires** : moment.js pour les dates

## 🎯 Fonctionnalités avancées

### Gestion intelligente des salles
- **Détection automatique** des amphithéâtres (AmphA, AmphB, AmphC)
- **Gestion des plages de salles** (ex: "111-112" → salles 111 et 112)
- **Organisation par étages** dans l'affichage Discord

### Système de groupes
- **Support des années** : A1, A2, A3
- **Gestion des groupes** : G1-G8 avec sous-groupes A/B
- **Affichage contextualisé** des cours par groupe

### Base de données optimisée
- **Relations normalisées** (professeurs, salles, matières, groupes)
- **Upserts intelligents** pour éviter les doublons
- **Requêtes optimisées** pour les performances

## 🤝 Contribution

Les contributions sont les bienvenues ! Que ce soit pour signaler des bugs, proposer des améliorations ou ajouter des fonctionnalités.

## 📄 Licence

Ce projet est sous licence libre.

---

*Développé avec ❤️ pour les étudiants d'informatique de l'IUT Limousin*