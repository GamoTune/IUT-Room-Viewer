// utils/logger.js
const { PrismaClient: PrismaClientStats } = require('../generated/stats-client');
// Initialisation du client Stats
const prismaStats = new PrismaClientStats();

async function logCommand(interaction) {
    try {
        const userId = BigInt(interaction.user.id);
        const userName = interaction.user.username;
        const globalName = interaction.user.global_name || interaction.user.username;
        // 1. Récupérer le nom de base (/commande)
        let fullCommandString = `/${interaction.commandName}`;

        // 2. Gestion des sous-commandes (si tu en as, ex: /salles chercher)
        // Le 'false' empêche de crasher s'il n'y a pas de sous-commande
        const subCommand = interaction.options.getSubcommand(false);
        if (subCommand) {
            fullCommandString += ` ${subCommand}`;
        }

        // 3. Récupérer les options/paramètres (ex: date:demain type:amphi)
        const options = interaction.options.data;

        if (options.length > 0) {
            // On transforme chaque option en format "nom:valeur"
            // Note : Pour les sous-commandes, les options sont parfois imbriquées, 
            // mais ce code simple couvre 90% des cas classiques.
            const params = options.map(option => {
                // Si c'est une sous-commande, les options sont un niveau plus bas, 
                // mais discord.js aplatit souvent ça.
                // Si l'option a une valeur directe :
                if (option.value !== undefined) {
                    return `${option.name}:${option.value}`;
                }
                // Cas spécifique des options imbriquées (si tu utilises des groupes)
                if (option.options) {
                    return option.options.map(o => `${o.name}:${o.value}`).join(' ');
                }
                return '';
            }).join(' ');

            if (params.trim() !== '') {
                fullCommandString += ` ${params}`;
            }
        }

        // 1. On s'assure que l'utilisateur existe (Upsert)
        const userDb = await prismaStats.users.upsert({
            where: { user_id: userId },
            update: { name: userName, global_name: globalName },
            create: {
                user_id: userId,
                name: userName,
                global_name: globalName
            }
        });

        // 2. Création de la requête en utilisant l'ID interne (userDb.id)
        await prismaStats.requests.create({
            data: {
                user: userDb.id, 
                request_date: new Date(),
                request_text: fullCommandString
            }
        });

        console.log(`[LOG] Commande '${fullCommandString}' enregistrée pour ${userName}.`);

    } catch (error) {
        console.error("Erreur lors du log de la commande :", error);
    }
}

module.exports = { logCommand };