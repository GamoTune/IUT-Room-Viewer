// ============================================
// 📁 src/index.ts
// Bot entry point
// ============================================

import "dotenv/config";
import { Client, Collection, GatewayIntentBits, REST, Routes } from "discord.js";

// Import commands
import {
    helpCommand,
    sallesMaintenantCommand,
    sallesEntreCommand,
    edtProfCommand,
} from "./commands/index.js";

// Import events
import { readyEvent, interactionCreateEvent } from "./events/index.js";

import type { BotCommand, BotEvent } from "./types/index.js";

// Extend Discord.js Client type to include commands
declare module "discord.js" {
    interface Client {
        commands: Collection<string, BotCommand>;
    }
}

// Create client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Register commands
const commands: BotCommand[] = [
    helpCommand,
    sallesMaintenantCommand,
    sallesEntreCommand,
    edtProfCommand,
];

for (const command of commands) {
    client.commands.set(command.data.name, command);
}

// Register events
const events: BotEvent[] = [readyEvent, interactionCreateEvent];

for (const event of events) {
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Refresh slash commands with Discord
async function refreshCommands() {
    const rest = new REST().setToken(process.env.TOKEN!);

    try {
        console.log(`🔄 Refreshing ${commands.length} slash commands...`);

        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
            body: commands.map((c) => c.data.toJSON()),
        });

        console.log(`✅ Successfully refreshed ${commands.length} commands`);
    } catch (error) {
        console.error("Error refreshing commands:", error);
    }
}

// Start bot
async function main() {
    await refreshCommands();
    console.log(`📦 Loaded ${client.commands.size} commands`);
    await client.login(process.env.TOKEN);
}

main().catch(console.error);
