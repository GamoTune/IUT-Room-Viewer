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
            .setColor('#a66949')
            .setTitle('Aide des commandes')
            .setDescription('Aides pour les commandes disponibles.')
            .addFields(
                { name: '/help', value: 'Affiche cette aide.', inline: true },
                { name: '/salles_maintenant', value: 'Affiche des informations sur les salles maintenant', inline: true },
                { name: '/salles_entre', value: 'Affiche des informations sur les salles entre 2 horaires', inline: true },
            )
            .setFooter({ text: "ver. " + process.env.VERSION });

        // Modification de la réponse pour afficher l'embed
        await interaction.editReply({ embeds: [embed] });
    },
};