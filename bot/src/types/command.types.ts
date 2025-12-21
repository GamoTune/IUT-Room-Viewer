// ============================================
// 📁 src/types/command.types.ts
// Discord command type definitions
// ============================================

import type {
    ChatInputCommandInteraction,
    SharedSlashCommand,
} from "discord.js";

/**
 * Discord slash command structure
 */
export interface BotCommand {
    data: SharedSlashCommand;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

/**
 * Discord event structure
 */
export interface BotEvent {
    name: string;
    once?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: (...args: any[]) => void | Promise<void>;
}

