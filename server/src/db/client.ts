// ============================================
// 📁 src/db/client.ts
// Connexion Drizzle à la base EDT (PostgreSQL)
// ============================================

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const url = process.env.EDT_DATABASE_URL;

if (!url) {
    throw new Error(
        "EDT_DATABASE_URL est absent de l'environnement (voir server/.env)",
    );
}

const pool = new Pool({ connectionString: url, max: 10 });

export const db = drizzle(pool, { schema });

export type Database = typeof db;

/**
 * Ferme le pool. Utilisé par les commandes CLI pour que le process se termine.
 */
export async function closeDatabase(): Promise<void> {
    await pool.end();
}
