import { PrismaClient } from "../../generated/edt-client/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Prisma 7 requires a driver adapter for MySQL/MariaDB
const adapter = new PrismaMariaDb(process.env.EDT_DATABASE_URL!);

const PRISMA_CLIENT_EDT = new PrismaClient({ adapter });

export default PRISMA_CLIENT_EDT;