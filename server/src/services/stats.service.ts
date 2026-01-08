// ============================================
// 📁 src/services/stats.service.ts
// Service pour les statistiques
// ============================================

import PRISMA_CLIENT_STATS from "../lib/prismaSTATS.js";

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
    const discordUserIdBigInt = BigInt(discordUserId);

    // Récupérer ou créer l'utilisateur
    let user = await PRISMA_CLIENT_STATS.users.findUnique({
        where: { user_id: discordUserIdBigInt },
    });

    if (!user) {
        // Créer un nouvel utilisateur
        user = await PRISMA_CLIENT_STATS.users.create({
            data: {
                user_id: discordUserIdBigInt,
                name: username,
                global_name: globalName,
            },
        });
        console.log(`[STATS] Created new user: ${username} (${discordUserId})`);
    } else {
        // Mettre à jour les infos si elles ont changé
        if (user.name !== username || user.global_name !== globalName) {
            user = await PRISMA_CLIENT_STATS.users.update({
                where: { id: user.id },
                data: {
                    name: username,
                    global_name: globalName,
                },
            });
        }
    }

    // Créer l'entrée de log
    await PRISMA_CLIENT_STATS.requests.create({
        data: {
            request_date: new Date(),
            request_text: command,
            user: user.id,
        },
    });

    console.log(`[STATS] Logged command: ${command} by ${username}`);
}
