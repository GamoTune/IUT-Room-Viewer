// ============================================
// 📁 src/commands/help.ts
// Help command
// ============================================

import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { BotCommand } from "../types/index.js";

export const helpCommand: BotCommand = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Affiche une aide sur les commandes disponibles."),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor("#a66949")
            .setTitle("Aide des commandes")
            .setDescription("Liste des commandes disponibles")
            .addFields(
                { name: "/help", value: "Affiche cette aide.", inline: true },
                { name: "/salles_maintenant", value: "Affiche l'état actuel des salles", inline: true },
                { name: "/salles_entre", value: "Affiche l'état des salles entre 2 horaires", inline: true }
            )
            .setFooter({ text: `ver. ${process.env.VERSION ?? "1.0.0"}` });

        await interaction.reply({ embeds: [embed] });
    },
};
