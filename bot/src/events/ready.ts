// ============================================
// 📁 src/events/ready.ts
// Bot ready event handler
// ============================================

import { Events, type Client } from "discord.js";
import type { BotEvent } from "../types/index.js";

export const readyEvent: BotEvent = {
    name: Events.ClientReady,
    once: true,
    execute(client: Client) {
        console.log(`✅ Ready! Logged in as ${client.user?.tag}`);
    },
};

