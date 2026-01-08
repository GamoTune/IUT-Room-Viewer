// ============================================
// 📁 src/services/logger.service.ts
// Command logging service - sends logs to API server
// ============================================

import type { ChatInputCommandInteraction } from "discord.js";

const API_URL = process.env.API_URL || "http://localhost:3000";
const API_SECRET_KEY = process.env.API_SECRET_KEY;

/**
 * Build the full command string from an interaction
 */
function buildCommandString(interaction: ChatInputCommandInteraction): string {
    let fullCommandString = `/${interaction.commandName}`;

    // Handle subcommands
    const subCommand = interaction.options.getSubcommand(false);
    if (subCommand) {
        fullCommandString += ` ${subCommand}`;
    }

    // Get options/parameters
    const options = interaction.options.data;
    if (options.length > 0) {
        const params = options
            .map((option) => {
                if (option.value !== undefined) {
                    return `${option.name}:${option.value}`;
                }
                if (option.options) {
                    return option.options.map((o) => `${o.name}:${o.value}`).join(" ");
                }
                return "";
            })
            .join(" ");

        if (params.trim() !== "") {
            fullCommandString += ` ${params}`;
        }
    }

    return fullCommandString;
}

/**
 * Log a command usage to console and send to API server
 */
export async function logCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const userName = interaction.user.username;
        const fullCommandString = buildCommandString(interaction);

        // Console log
        console.log(`[LOG] Command '${fullCommandString}' executed by ${userName}`);

        // Send to API server
        if (!API_SECRET_KEY) {
            console.warn("[STATS] API_SECRET_KEY not set, skipping database logging");
            return;
        }

        const response = await fetch(`${API_URL}/api/v1/stats/log`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": API_SECRET_KEY,
            },
            body: JSON.stringify({
                discordUserId: interaction.user.id,
                username: interaction.user.username,
                globalName: interaction.user.globalName,
                command: fullCommandString,
            }),
        });

        if (!response.ok) {
            console.error(`[STATS] API error: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error("[STATS] Error sending log to API:", error);
        // Don't throw - logging should not break the command
    }
}
