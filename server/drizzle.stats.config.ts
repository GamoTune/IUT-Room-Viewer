import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/db/schema.stats.ts",
    out: "./drizzle-stats",
    dbCredentials: {
        url: process.env.STATS_DATABASE_URL!,
    },
    casing: "snake_case",
});
