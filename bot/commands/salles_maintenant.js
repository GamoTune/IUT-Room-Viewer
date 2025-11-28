// Discord.js slash command for checking current room availability
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config();

// Import custom modules for room data and field creation
const { rooms_availability } = require('../ask');
const { create_fields } = require('../create_fields')
const { logCommand } = require('../logger');


module.exports = {
    // Define the slash command structure - simple command with no options
    data: new SlashCommandBuilder()
        .setName('salles_maintenant')
        .setDescription('Affiche l\'état actuel des salles .'),
    async execute(interaction) {
        // Send initial loading message to user
        await interaction.reply('Récupération des salles...');

        const now = new Date();
        const rooms = await rooms_availability(now, now);
        const embedFields = await create_fields(rooms);

        // Handle error if no room data could be retrieved
        if (Object.keys(embedFields).length === 0) {
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

        logCommand(interaction);
    },
};