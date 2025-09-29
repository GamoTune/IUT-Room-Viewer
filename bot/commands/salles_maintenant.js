// Discord.js slash command for checking current room availability
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config();

// Import custom modules for room data and field creation
const { rooms_availability } = require('../ask');
const { create_fields } = require('../create_fields')


module.exports = {
    // Define the slash command structure - simple command with no options
    data: new SlashCommandBuilder()
        .setName('salles_maintenant')
        .setDescription('Affiche l\'état actuel des salles .'),
    async execute(interaction) {
        // Send initial loading message to user
        await interaction.reply('Récupération des salles...');

        // Get current timestamp for real-time room availability
        const now = new Date();

        // Fetch current room availability (using same time for start and end to get current status)
        const rooms = await rooms_availability(now, now);

        // Format room data into Discord embed fields
        const embedFields = await create_fields(rooms);

        // Handle error if no room data could be retrieved
        if (embedFields == {}) {
            await interaction.editReply("Erreur lors de la récupération des salles.");
            return;
        }

        // Create Discord embed with current room information
        const embed = new EmbedBuilder()
            .setColor('#a66949')
            .setTitle('Informations salles')
            .setDescription('Informations sur les salles actuelles')
            .addFields(embedFields)
            .setFooter({ text: '✅ : Disponible  |  ❌ : Occupée'});

        // Update the initial reply with the formatted embed
        await interaction.editReply({ content: '', embeds: [embed] });
    },
};