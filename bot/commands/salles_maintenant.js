const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { rooms_availability } = require('../ask');
const { create_fields } = require('../create_fields')
require('dotenv').config();


module.exports = {
    data: new SlashCommandBuilder()
        .setName('salles_maintenant')
        .setDescription('Affiche l\'état actuel des salles .'),
    async execute(interaction) {
        await interaction.reply('Vérification des salles...');

        // Set time
        const now = new Date();

        // Get rooms availability
        const rooms = await rooms_availability(now, now);



        // Création des champs pour l'embed
        const embedFields = await create_fields(rooms);

        // Création de l'embed
        const embed = new EmbedBuilder()
            .setColor('#a66949')
            .setTitle('Salles libres')
            .setDescription('Informations sur les salles actuelles')
            .addFields(embedFields)
            .setFooter({ text: '✅ : Disponible  |  ❌ : Occupée'});

        // Modification de la réponse pour afficher l'embed
        await interaction.editReply({ content: '', embeds: [embed] });
    },
};