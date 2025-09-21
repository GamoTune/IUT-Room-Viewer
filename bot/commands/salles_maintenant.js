const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { rooms_availability } = require('../ask');
const { create_fields } = require('../create_fields')
require('dotenv').config();


module.exports = {
    data: new SlashCommandBuilder()
        .setName('salles_maintenant')
        .setDescription('Affiche l\'état actuel des salles .'),
    async execute(interaction) {
        await interaction.reply('Récupération des salles...');

        // Set time
        const now = new Date();

        // Get rooms availability
        const rooms = await rooms_availability(now, now);

        // Create fields for the embed
        const embedFields = await create_fields(rooms);

        if (embedFields == {}) {
            await interaction.editReply("Erreur lors de la récupération des salles.");
            return;
        }

        // Create the embed
        const embed = new EmbedBuilder()
            .setColor('#a66949')
            .setTitle('Informations salles')
            .setDescription('Informations sur les salles actuelles')
            .addFields(embedFields)
            .setFooter({ text: '✅ : Disponible  |  ❌ : Occupée'});

        // Edit the reply to show the embed
        await interaction.editReply({ content: '', embeds: [embed] });
    },
};