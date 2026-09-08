// ============================================
// 📁 src/services/stats.service.ts
// Service pour les statistiques
// ============================================

import dataSource from "../utils/dataSource.js";
import { Request } from "../entities/request.entity.js";
import { User } from "../entities/user.entity.js";

interface LogCommandData {
    discordUserId: string;
    username: string;
    globalName: string | null;
    command: string;
}

/**
 * Log une commande du bot Discord en base de données
 */
export async function logCommandService(data: LogCommandData): Promise<void> {
    const { discordUserId, username, globalName, command } = data;

    const users = dataSource.getRepository(User);
    const existing = await users.findOneBy({ discordId: discordUserId });

    // Les pseudos changent : on rafraîchit ceux d'un utilisateur déjà connu
    const user = await users.save({
        ...(existing ?? {}),
        discordId: discordUserId,
        name: username,
        globalName,
    });

    await dataSource.getRepository(Request).save({
        requestText: command,
        user,
    });

    console.log(`[STATS] Logged command: ${command} by ${username}`);
}
