// ============================================
// 📁 src/services/logger.service.ts
// Command logging service
// ============================================

import type { ChatInputCommandInteraction } from "discord.js";

// For now, just console log. Stats DB integration can be added later.
// The original used a separate Prisma client for stats which we'll skip for simplicity.

/**
 * Log a command usage
 */
export async function logCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const userName = interaction.user.username;

        // Build full command string
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

        console.log(`[LOG] Command '${fullCommandString}' executed by ${userName}`);

        // TODO: Add stats database logging here if needed
    } catch (error) {
        console.error("Error logging command:", error);
    }
}
