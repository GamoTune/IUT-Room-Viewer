import { PrismaClient } from "../../generated/stats-client/client.js";

const PRISMA_CLIENT_STATS: PrismaClient = new PrismaClient();

export default PRISMA_CLIENT_STATS;