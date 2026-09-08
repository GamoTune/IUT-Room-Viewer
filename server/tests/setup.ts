// ============================================
// 📁 tests/setup.ts
// Préchargé par `bun test` (voir bunfig.toml)
// ============================================
//
// Les modules d'accès aux bases ouvrent une connexion dès leur import. On les
// remplace ici, avant que le moindre fichier de test n'importe un repository.

import { mock } from "bun:test";
import { prismaEdtMock, prismaStatsMock } from "./helpers/prisma-mock.js";

await mock.module("../src/lib/prismaEDT.ts", () => ({ default: prismaEdtMock }));
await mock.module("../src/lib/prismaSTATS.ts", () => ({ default: prismaStatsMock }));

// Client Drizzle (nouvelle base PostgreSQL) : importé indirectement par
// `lesson.repository.ts`, il crée un pool `pg` et lève si l'URL est absente.
await mock.module("../src/db/client.ts", () => ({
    db: {},
    closeDatabase: async () => {},
}));

// Librairie Unilim (récupération des EDT publiés) : elle déclenche des appels
// réseau et n'est pas nécessaire pour tester le contrôleur de synchronisation.
await mock.module("unilim/iut/cs/timetable", () => ({
    OnlineTimetable: {
        getTimetableEntries: async () => [],
    },
    TimetableYear: { A1: "A1", A2: "A2", A3: "A3" },
    LESSON_TYPES: { CM: "CM", TD: "TD", TP: "TP" },
    SUBGROUPS: { A: "A", B: "B" },
}));
