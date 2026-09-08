// ============================================
// 📁 src/db/client.stats.ts
// Connexion Drizzle à la base stats (PostgreSQL)
// ============================================

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.stats.js";

const url = process.env.STATS_DATABASE_URL;

if (!url) {
    throw new Error(
        "STATS_DATABASE_URL est absent de l'environnement (voir server/.env)",
    );
}

const pool = new Pool({ connectionString: url, max: 5 });

export const statsDb = drizzle(pool, { schema });

export async function closeStatsDatabase(): Promise<void> {
    await pool.end();
}
