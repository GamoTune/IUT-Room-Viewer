// Discord.js slash command for checking room availability between two time periods
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment');
require('dotenv').config();

// Import custom modules for room data and field creation
const { rooms_availability } = require('../ask.js');
const { create_fields } = require('../create_fields.js');


// Function to validate date string format using moment.js
async function isValidDate(dateString) {
    return moment(dateString, 'YYYY-MM-DD HH:mm:ss', true).isValid();
};


module.exports = {
    // Define the slash command structure and options
    data: new SlashCommandBuilder()
        .setName('salles_entre')
        .setDescription('Affiche l\'état des salles entre deux horaires.') // Display room status between two time periods
        .addIntegerOption(option => option.setName('heure_début').setDescription('Heure de début').setRequired(true)) // Start hour (required)
        .addIntegerOption(option => option.setName('heure_fin').setDescription('Heure de fin').setRequired(true)) // End hour (required)
        .addIntegerOption(option => option.setName('minute_debut').setDescription('Minute de début').setRequired(false)) // Start minute (optional)
        .addIntegerOption(option => option.setName('minute_fin').setDescription('Minute de fin').setRequired(false)) // End minute (optional)
        .addIntegerOption(option => option.setName('jour').setDescription('Jour').setRequired(false)) // Day (optional)
        .addIntegerOption(option => option.setName('mois').setDescription('Mois').setRequired(false)) // Month (optional)
        .addIntegerOption(option => option.setName('année').setDescription('Année').setRequired(false)), // Year (optional)
    async execute(interaction) {

        // Extract user input from slash command options
        // Required parameters
        var inputHourStart = interaction.options.getInteger('heure_début');
        var inputHourEnd = interaction.options.getInteger('heure_fin');
        
        // Optional parameters with default values
        var inputMinuteStart = interaction.options.getInteger('minute_debut') || 0; // Default to 0 minutes
        var inputMinuteEnd = interaction.options.getInteger('minute_fin') || 0; // Default to 0 minutes
        var inputDay = interaction.options.getInteger('jour') || new Date().getDate(); // Default to current day
        var inputMonth = interaction.options.getInteger('mois') || new Date().getMonth() + 1; // Default to current month
        var inputYear = interaction.options.getInteger('année') || new Date().getFullYear(); // Default to current year

        // Format time and date values with leading zeros for consistency
        if (inputHourStart < 10) {
            inputHourStart = "0" + inputHourStart;
        }
        if (inputHourEnd < 10) {
            inputHourEnd = "0" + inputHourEnd;
        }
        if (inputMinuteStart < 10) {
            inputMinuteStart = "0" + inputMinuteStart;
        }
        if (inputMinuteEnd < 10) {
            inputMinuteEnd = "0" + inputMinuteEnd;
        }
        if (inputDay < 10) {
            inputDay = "0" + inputDay;
        }
        if (inputMonth < 10) {
            inputMonth = "0" + inputMonth;
        }


        // Create formatted date strings in YYYY-MM-DD HH:mm:ss format
        var startTimeString = `${inputYear}-${inputMonth}-${inputDay} ${inputHourStart}:${inputMinuteStart}:00`;
        var endTimeString = `${inputYear}-${inputMonth}-${inputDay} ${inputHourEnd}:${inputMinuteEnd}:00`;

        // Validate date format using moment.js
        if (!await isValidDate(startTimeString) || !await isValidDate(endTimeString)) {
            await interaction.reply("La date n'est pas valide."); // "The date is not valid."
            return;
        }

        // Convert strings to Date objects for comparison
        const startTime = new Date(startTimeString);
        const endTime = new Date(endTimeString);

        // Ensure start time is before end time
        if (startTime >= endTime) {
            await interaction.reply("L'heure de début doit être inférieure à l'heure de fin.");
            return;
        }


        // Fetch room availability data for the specified time period
        await interaction.reply('Récupération des salles...');
        const rooms = await rooms_availability(startTime, endTime);

        // Format room data into Discord embed fields
        const embedFields = await create_fields(rooms);

        // Handle error if no room data could be retrieved
        if (embedFields == {}) {
            await interaction.editReply("Erreur lors de la récupération des salles.");
            return;
        }

        // Create Discord embed with room information
        const embed = new EmbedBuilder()
            .setColor('#a66949')
            .setTitle('Informations salles')
            .setDescription(`Informations sur les salles entre **${inputHourStart}H${inputMinuteStart}** et **${inputHourEnd}H${inputMinuteEnd}** le **${inputDay}/${inputMonth}/${inputYear}**`)
            .addFields(embedFields)
            .setFooter({ text: '✅ : Disponible  |  ❌ : Occupée'});

        // Update the initial reply with the formatted embed
        await interaction.editReply({ content: "", embeds: [embed] });
    },
};