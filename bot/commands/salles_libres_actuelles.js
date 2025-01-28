const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const { get_all_rooms_availability } = require('../../script.js');
const { create_fields } = require('../../create_fields.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('salles_libres_actuelles')
        .setDescription('Affiche la liste des salles libres actuellement.'),
    async execute(interaction) {
        await interaction.reply('Vérification des salles...');
        const startTime = new Date();
        const rooms = await get_all_rooms_availability(startTime, startTime);

        // Création des champs pour l'embed
        const embedFields = await create_fields(rooms);

        if (embedFields == {}) {
            await interaction.editReply('Aucune salle n\'est libre actuellement.');
            return;
        }

        // Création de l'embed
        const embed = new EmbedBuilder()
            .setColor('#a66949')
            .setTitle('Salles libres')
            .setDescription('Liste des salles libres actuellement.')
            .addFields(embedFields)
            .setFooter({ text: '✅ : Salle libre | ❌ : Salle occupée' });

        // Modification de la réponse pour afficher l'embed
        await interaction.editReply({ content: '', embeds: [embed] });
    },
};