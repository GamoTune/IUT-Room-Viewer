const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment');
require('dotenv').config();

const { rooms_availability } = require('../ask.js');
const { create_fields } = require('../create_fields.js');


async function isValidDate(dateString) {
    return moment(dateString, 'YYYY-MM-DD HH:mm:ss', true).isValid();
};


module.exports = {
    data: new SlashCommandBuilder()
        .setName('salles_libres_entre')
        .setDescription('Affiche l\'état des salles entre deux horaires.')
        .addIntegerOption(option => option.setName('heure_début').setDescription('Heure de début').setRequired(true))
        .addIntegerOption(option => option.setName('heure_fin').setDescription('Heure de fin').setRequired(true))
        .addIntegerOption(option => option.setName('minute_debut').setDescription('Minute de début').setRequired(false))
        .addIntegerOption(option => option.setName('minute_fin').setDescription('Minute de fin').setRequired(false))
        .addIntegerOption(option => option.setName('jour').setDescription('Jour').setRequired(false))
        .addIntegerOption(option => option.setName('mois').setDescription('Mois').setRequired(false))
        .addIntegerOption(option => option.setName('année').setDescription('Année').setRequired(false)),
    async execute(interaction) {

        // Récupération des paramètres
        var inputHourStart = interaction.options.getInteger('heure_début');
        var inputHourEnd = interaction.options.getInteger('heure_fin');
        var inputMinuteStart = interaction.options.getInteger('minute_debut') || 0;
        var inputMinuteEnd = interaction.options.getInteger('minute_fin') || 0;
        var inputDay = interaction.options.getInteger('jour') || new Date().getDate();
        var inputMonth = interaction.options.getInteger('mois') || new Date().getMonth() + 1;
        var inputYear = interaction.options.getInteger('année') || new Date().getFullYear();

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


        // Création des dates de début et de fin
        var startTimeString = `${inputYear}-${inputMonth}-${inputDay} ${inputHourStart}:${inputMinuteStart}:00`;
        var endTimeString = `${inputYear}-${inputMonth}-${inputDay} ${inputHourEnd}:${inputMinuteEnd}:00`;

        if (!await isValidDate(startTimeString) || !await isValidDate(endTimeString)) {
            await interaction.reply("La date n'est pas valide.");
            return;
        }


        const startTime = new Date(startTimeString);
        const endTime = new Date(endTimeString);


        if (startTime >= endTime) {
            await interaction.reply("L'heure de début doit être inférieure à l'heure de fin.");
            return;
        }


        // Vérification des salles libres
        await interaction.reply('Vérification des salles libres...');
        const rooms = await rooms_availability(startTime, endTime);

        // Création des champs pour l'embed
        const embedFields = await create_fields(rooms);

        if (embedFields == {}) {
            await interaction.editReply("Aucune salle n'est libre à ce moment. ~~non le bot fait de la merde~~");
            return;
        }

        // Création de l'embed
        const embed = new EmbedBuilder()
            .setColor('#a66949')
            .setTitle('Salles libres')
            .setDescription(`Informations sur les salles entre **${inputHourStart}H${inputMinuteStart}** et **${inputHourEnd}H${inputMinuteEnd}** le **${inputDay}/${inputMonth}/${inputYear}**`)
            .addFields(embedFields)
            .setFooter({ text: '✅ : Disponible  |  ❌ : Occupée'});

        // Modification de la réponse pour afficher l'embed
        await interaction.editReply({ content: "", embeds: [embed] });
    },
};