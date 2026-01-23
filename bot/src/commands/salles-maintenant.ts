// ============================================
// 📁 src/commands/salles-maintenant.ts
// Current room availability command
// ============================================

import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../types/index.js";
import { ApiService } from "../services/api.service.js";
import { createRoomAvailabilityEmbed } from "../utils/embed-builder.js";
import { logCommand } from "../services/logger.service.js";


export const sallesMaintenantCommand: BotCommand = {
    data: new SlashCommandBuilder()
        .setName("salles_maintenant")
        .setDescription("Affiche l'état actuel des salles."),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const now = new Date();
            const rooms = await ApiService.instance.getRoomsAvailability(now, now);

            const embed = createRoomAvailabilityEmbed(
                rooms,
                "État actuel des salles"
            );

            await interaction.editReply({ embeds: [embed] });
            logCommand(interaction);
        } catch (error) {
            console.error("Error fetching room availability:", error);
            await interaction.editReply("Erreur lors de la récupération des salles.");
        }
    },
};
