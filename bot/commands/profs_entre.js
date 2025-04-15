const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const { get_all_rooms_availability } = require('../../script.js');
const { create_fields } = require('../../create_fields.js');



module.exports = {
    data: new SlashCommandBuilder()
        .setName('profs_actuelles')
        .setDescription('Affiche si un prof a cours actuellement.')
        .addStringOption(option =>
            option.setName('prof')
                .setDescription('Nom du professeur')
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.reply('Vérification des salles...');

        // Récupération du nom du professeur
        const profName = interaction.options.getString('prof');

        const startTime = new Date();
        const rooms = await get_all_rooms_availability(startTime, startTime, profName);

        // Création des champs pour l'embed
        const embedFields = await create_fields(rooms);

        if (embedFields == {}) {
            await interaction.editReply('');
            return;
        }

        // Création de l'embed
        const embed = new EmbedBuilder()
            .setColor('#a66949')
            .setTitle(profName + "est actuellement en cours")
            .setDescription('Il ce trouve dans la salles ❌ suivantes :')
            .addFields(embedFields)
            .setFooter({ text: '✅ : Salle libre | ❌ : Salle occupée' });

        // Modification de la réponse pour afficher l'embed
        await interaction.editReply({ content: '', embeds: [embed] });
    },
};