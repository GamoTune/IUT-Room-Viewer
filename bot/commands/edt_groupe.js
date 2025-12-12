// Discord.js slash command for checking current room availability
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config();

// Import custom modules for room data and field creation
const { edt_group } = require('../ask');
const { create_fields } = require('../create_fields')
const { logCommand } = require('../logger');


module.exports = {
    // Define the slash command structure - simple command with no options
    data: new SlashCommandBuilder()
        .setName('edt_groupe')
        .setDescription('Affiche l\'emploi du temps d\'un groupe donné.')
        .addStringOption(option =>
            option.setName('groupe')
                .setDescription('Le nom du groupe (ex: G4B)')
                .setRequired(true)
                .addChoices(
                { name: 'G1A', value: 'G1A' },
                { name: 'G1B', value: 'G1B' },
                { name: 'G2A', value: 'G2A' },
                { name: 'G2B', value: 'G2B' },
                { name: 'G3A', value: 'G3A' },
                { name: 'G3B', value: 'G3B' },
                { name: 'G4A', value: 'G4A' },
                { name: 'G4B', value: 'G4B' },
                { name: 'G5A', value: 'G5A' },
                { name: 'G5B', value: 'G5B' },
                { name: 'G7A', value: 'G7A' },
                { name: 'G7B', value: 'G7B' },
                { name: 'G8', value: 'G8' },
            )
        ),
    async execute(interaction) {
        // Send initial loading message to user
        await interaction.reply('Cette commande est en cours de développement.');

        console.log(interaction.options.getString('groupe'));
        console.log(await edt_group(interaction.options.getString('groupe'), new Date(), new Date()));

        // await interaction.reply('Récupération des données...');

        // const now = new Date();
        // const rooms = await rooms_availability(now, now);
        // const embedFields = await create_fields(rooms);

        // // Handle error if no room data could be retrieved
        // if (Object.keys(embedFields).length === 0) {
        //     await interaction.editReply("Erreur lors de la récupération des salles.");
        //     return;
        // }

        // // Create Discord embed with current room information
        // const embed = new EmbedBuilder()
        //     .setColor('#a66949')
        //     .setTitle('Informations salles')
        //     .setDescription('Informations sur les salles actuelles')
        //     .addFields(embedFields)
        //     .setFooter({ text: '✅ : Disponible  |  ❌ : Occupée'});

        // // Update the initial reply with the formatted embed
        // await interaction.editReply({ content: '', embeds: [embed] });

        // logCommand(interaction);
    },
};