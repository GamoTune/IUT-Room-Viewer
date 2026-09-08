// ============================================
// 📁 src/db/seed.ts
// Alimentation du référentiel de salles
// ============================================

import "dotenv/config";
import { closeDatabase, db } from "./client.js";
import { room } from "./schema.js";
import { ROOM_REFERENCE } from "../sync/ics/rooms.reference.js";

/**
 * Insère ou met à jour les salles du département.
 * Idempotent : relançable à volonté.
 */
export async function seedRooms(): Promise<number> {
    for (const entry of ROOM_REFERENCE) {
        await db
            .insert(room)
            .values(entry)
            .onConflictDoUpdate({
                target: room.name,
                set: {
                    floor: entry.floor,
                    kind: entry.kind,
                    displayOrder: entry.displayOrder,
                    isActive: true,
                },
            });
    }

    return ROOM_REFERENCE.length;
}

if (import.meta.main) {
    seedRooms()
        .then(async (count) => {
            console.log(`✅ ${count} salles présentes dans le référentiel`);
            await closeDatabase();
        })
        .catch(async (error) => {
            console.error("❌ Seed impossible :", error);
            await closeDatabase();
            process.exit(1);
        });
}
