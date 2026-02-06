// ============================================
// 📁 src/commands/edt-prof.ts
// Room availability between two times command
// ============================================

import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../types/index.js";
import { ApiService } from "../services/api.service.js";
import { createEDTEmbed } from "../utils/embed-builder.js";
import { logCommand } from "../services/logger.service.js";
import { padZero } from "../utils/format.js";
import { CoursesApiParams, Course } from "../types/index.js";

export const edtProfCommand: BotCommand = {
    data: new SlashCommandBuilder()
        .setName("edt_prof")
        .setDescription("Affiche l'état des salles entre deux horaires.")
        .addStringOption((option) =>
            option.setName("nom").setDescription("Nom du professeur").setRequired(true)
        )
        .addStringOption((option) =>
            option.setName("alias").setDescription("Code du professeur (ex: TH pour Thomas Hugel)").setRequired(true)
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

        const professorName = interaction.options.getString("nom", true);
        const professorAlias = interaction.options.getString("alias", true);

        // Get optional date parameters, default to today
        
        const now = new Date();
        const day = interaction.options.getInteger("jour") ?? now.getDate();
        const month = interaction.options.getInteger("mois") ?? now.getMonth() + 1;
        const year = interaction.options.getInteger("année") ?? now.getFullYear();

        // Build dates
        const startTime = new Date(year, month - 1, day, 0, 0, 0);
        const endTime = new Date(year, month - 1, day, 23, 59, 59);

        await interaction.deferReply();

        try {

            const params: CoursesApiParams = {
                startAt: startTime,
                endAt: endTime,
                teachers: [professorName, professorAlias],
            };


            const courses: Course[] = await ApiService.instance.getCourses(params);

            const description = `Edt du professeur ${professorName} (${professorAlias}) pour le ${padZero(day)}/${padZero(month)}/${year}`;

            const embed = createEDTEmbed(courses, description);

            await interaction.editReply({ embeds: [embed] });
            logCommand(interaction);
        } catch (error) {
            console.error("Error fetching room availability:", error);
            await interaction.editReply("Erreur lors de la récupération des salles.");
        }
    },
};
