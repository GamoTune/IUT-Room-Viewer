// ============================================
// 📁 src/cli/seed.ts
// Alimentation du référentiel de salles
//
//   bun run db:seed
// ============================================

import "dotenv/config";
import dataSource, { closeDatabase, initializeDatabase } from "../utils/dataSource.js";
import { Room } from "../entities/room.entity.js";
import { ROOM_REFERENCE } from "../sync/rooms.reference.js";

/**
 * Insère ou met à jour les salles du département. Idempotent.
 */
export async function seedRooms(): Promise<number> {
    const rooms = dataSource.getRepository(Room);

    for (const entry of ROOM_REFERENCE) {
        const existing = await rooms.findOneBy({ name: entry.name });
        await rooms.save({ ...(existing ?? {}), ...entry, isActive: true });
    }

    return ROOM_REFERENCE.length;
}

if (import.meta.main) {
    try {
        await initializeDatabase();
        const count = await seedRooms();
        console.log(`✅ ${count} salles présentes dans le référentiel`);
    } catch (error) {
        console.error("❌ Seed impossible :", error);
        process.exitCode = 1;
    } finally {
        await closeDatabase();
    }
}
