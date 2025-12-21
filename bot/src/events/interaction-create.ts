// ============================================
// 📁 src/events/interaction-create.ts
// Command interaction handler
// ============================================

import { Events, type Interaction } from "discord.js";
import type { BotEvent, BotCommand } from "../types/index.js";

export const interactionCreateEvent: BotEvent = {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands?.get(interaction.commandName) as BotCommand | undefined;

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}:`, error);

            const errorMessage = "Une erreur est survenue lors de l'exécution de la commande.";

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};

