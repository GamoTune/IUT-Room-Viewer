// ============================================
// 📁 src/db/schema.stats.ts
// Schéma de la base stats du bot (Drizzle / PostgreSQL)
// ============================================

import { bigint, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Utilisateur Discord ayant lancé au moins une commande.
 * `discord_id` est l'identifiant Discord (snowflake), stocké en bigint.
 */
export const users = pgTable("users", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    discordId: bigint("discord_id", { mode: "bigint" }).notNull().unique(),
    name: varchar("name", { length: 100 }),
    globalName: varchar("global_name", { length: 100 }),
});

/**
 * Une commande exécutée, conservée pour les statistiques d'usage.
 */
export const requests = pgTable(
    "requests",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        requestDate: timestamp("request_date", { withTimezone: true }).notNull().defaultNow(),
        requestText: text("request_text").notNull(),
        userId: integer("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
    },
    (table) => [index("requests_user").on(table.userId)],
);

export const usersRelations = relations(users, ({ many }) => ({
    requests: many(requests),
}));

export const requestsRelations = relations(requests, ({ one }) => ({
    user: one(users, { fields: [requests.userId], references: [users.id] }),
}));
