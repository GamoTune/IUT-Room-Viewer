// ============================================
// 📁 src/controllers/stats.controller.ts
// Controller pour les statistiques
// ============================================

import type { Request, Response } from "express";
import { logCommandService } from "../services/stats.service.js";

interface LogCommandBody {
    discordUserId: string;
    username: string;
    globalName: string | null;
    command: string;
}

/**
 * Log une commande du bot Discord
 * POST /api/v1/stats/log
 */
export async function logCommandController(req: Request, res: Response): Promise<void> {
    try {
        const { discordUserId, username, globalName, command } = req.body as LogCommandBody;

        // Validation basique
        if (!discordUserId || !username || !command) {
            res.status(400).json({
                success: false,
                error: "Missing required fields: discordUserId, username, command",
            });
            return;
        }

        await logCommandService({
            discordUserId,
            username,
            globalName,
            command,
        });

        res.json({ success: true });
    } catch (error) {
        console.error("[STATS] Error logging command:", error);
        res.status(500).json({
            success: false,
            error: "Failed to log command",
        });
    }
}
