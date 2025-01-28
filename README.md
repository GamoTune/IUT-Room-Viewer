# IUT-Room-viewer
## Description
IUT Room Viewer est un script JS permettant de visualiser les salles libres et occupées du département informatique de l'IUT du limousin.

## Utilisation
- Integrations pour serveurs ou clients : [IUT-Room-viewer](https://discord.com/oauth2/authorize?client_id=1331626843257966613)
- Bot pour serveurs : [Salles IUT](https://discord.com/oauth2/authorize?client_id=1331626843257966613&permissions=2147485696&integration_type=0&scope=bot)

## Fonctionnalités
- Script pour récupérer états des salles
- Bot Discord afin de visualisé les données dans Discord

## Prérequis
- [Node.js](https://nodejs.org/en/)
- [npm](https://www.npmjs.com/)

## Installation
1. Clonez le dépôt :
    ```bash
    git clone https://github.com/GamoTune/IUT-Room-viewer.git
    ```
2. Accédez au répertoire du projet :
    ```bash
    cd IUT-Room-viewer
    ```
3. Installez les dépendances :
    ```bash
    npm install
    ```

### Configuration pour le bot Discord

1. Créez une application sur le [portail développeur Discord](https://discord.com/developers/applications)
    - Récupérez le token de votre bot et son identifiant

2. Créez un fichier `.env` à la racine du projet

3. Ajoutez les variables suivantes :
    ```env
    TOKEN="le-token-de-votre-bot-discord"
    CLIENT_ID="ID-de-votre-bot-discord"
    ```

4. Lancez le bot :
    ```bash
    node bot/index.js
    ```