const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config()

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche une aide sur les commandes disponibles.'),
    async execute(interaction) {



        await interaction.deferReply();

        // Création de l'embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Aide des commandes')
            .setDescription('Aides pour les commandes disponibles.')
            .addFields(
                { name: '/help', value: 'Affiche cette aide.', inline: true },
                { name: '/ping', value: 'Affiche le dernier temps de réponse du bot.', inline: true },
                { name: '/salles_libres_actuelles', value: 'Affiche les salles libres actuelles.', inline: true },
                { name: '/salles_libres_entre', value: 'Affiche les salles libres entre 2 moments.', inline: true },
            )
            .setFooter({ text: "ver. " + process.env.VERSION });

        // Modification de la réponse pour afficher l'embed
        await interaction.editReply({ embeds: [embed] });
    },
};