// ============================================
// 📁 src/commands/salles-entre.ts
// Room availability between two times command
// ============================================

import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../types/index.js";
import { ApiService } from "../services/api.service.js";
import { createRoomAvailabilityEmbed } from "../utils/embed-builder.js";
import { logCommand } from "../services/logger.service.js";
import { padZero } from "../utils/format.js";

export const sallesEntreCommand: BotCommand = {
    data: new SlashCommandBuilder()
        .setName("salles_entre")
        .setDescription("Affiche l'état des salles entre deux horaires.")
        .addIntegerOption((option) =>
            option.setName("heure_début").setDescription("Heure de début").setRequired(true)
        )
        .addIntegerOption((option) =>
            option.setName("heure_fin").setDescription("Heure de fin").setRequired(true)
        )
        .addIntegerOption((option) =>
            option.setName("minute_debut").setDescription("Minute de début").setRequired(false)
        )
        .addIntegerOption((option) =>
            option.setName("minute_fin").setDescription("Minute de fin").setRequired(false)
        )
        .addIntegerOption((option) =>
            option.setName("jour").setDescription("Jour").setRequired(false)
        )
        .addIntegerOption((option) =>
            option.setName("mois").setDescription("Mois").setRequired(false)
        )
        .addIntegerOption((option) =>
            option.setName("année").setDescription("Année").setRequired(false)
        ),

    async execute(interaction) {
        // Get required parameters
        const hourStart = interaction.options.getInteger("heure_début", true);
        const hourEnd = interaction.options.getInteger("heure_fin", true);

        // Get optional parameters with defaults
        const minuteStart = interaction.options.getInteger("minute_debut") ?? 0;
        const minuteEnd = interaction.options.getInteger("minute_fin") ?? 0;
        const now = new Date();
        const day = interaction.options.getInteger("jour") ?? now.getDate();
        const month = interaction.options.getInteger("mois") ?? now.getMonth() + 1;
        const year = interaction.options.getInteger("année") ?? now.getFullYear();

        // Build dates
        const startTime = new Date(year, month - 1, day, hourStart, minuteStart, 0);
        const endTime = new Date(year, month - 1, day, hourEnd, minuteEnd, 0);

        // Validate
        if (startTime >= endTime) {
            await interaction.reply("L'heure de début doit être inférieure à l'heure de fin.");
            return;
        }

        await interaction.deferReply();

        try {
            const rooms = await ApiService.instance.getRoomsAvailability(startTime, endTime);

            const description = `Salles entre **${padZero(hourStart)}H${padZero(minuteStart)}** et **${padZero(hourEnd)}H${padZero(minuteEnd)}** le **${padZero(day)}/${padZero(month)}/${year}**`;

            const embed = createRoomAvailabilityEmbed(rooms, description);

            await interaction.editReply({ embeds: [embed] });
            logCommand(interaction);
        } catch (error) {
            console.error("Error fetching room availability:", error);
            await interaction.editReply("Erreur lors de la récupération des salles.");
        }
    },
};
