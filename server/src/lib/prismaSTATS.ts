import { PrismaClient } from "../../generated/stats-client/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Prisma 7 requires a driver adapter for MySQL/MariaDB
const adapter = new PrismaMariaDb(process.env.STATS_DATABASE_URL!);

const PRISMA_CLIENT_STATS = new PrismaClient({ adapter });

export default PRISMA_CLIENT_STATS;