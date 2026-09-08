// ============================================
// 📁 tests/helpers/prisma-mock.ts
// Faux clients Prisma partagés par les tests
// ============================================
//
// Les repositories importent un client Prisma déjà instancié
// (`src/lib/prismaEDT.ts`), qui ouvre une connexion MariaDB au chargement du
// module. Les tests substituent ces modules (voir `tests/setup.ts`) par les
// objets ci-dessous : mêmes méthodes, mais pilotées depuis les tests.
//
// L'identité des objets `prismaEdtMock` / `prismaStatsMock` ne change jamais :
// `resetPrismaMocks()` remplace uniquement leurs modèles, ce qui suffit puisque
// le code sous test lit `prisma.lesson.findMany` au moment de l'appel.

import { mock } from "bun:test";

/** Un modèle Prisma factice : chaque méthode renvoie la valeur par défaut donnée. */
function createModel<T extends Record<string, unknown>>(defaults: T) {
    const model = {} as { [K in keyof T]: ReturnType<typeof mock> };
    for (const [method, value] of Object.entries(defaults)) {
        model[method as keyof T] = mock(async () => value);
    }
    return model;
}

function createEdtModels() {
    return {
        lesson: createModel({
            findMany: [] as unknown[],
            findFirst: null,
            create: { id: 1 },
            deleteMany: { count: 0 },
        }),
        lesson_group: createModel({
            upsert: { lesson_id: 1, group_id: 1 },
        }),
        lesson_room: createModel({
            upsert: { lesson_id: 1, room_id: 1 },
        }),
        room: createModel({
            findMany: [] as unknown[],
            findUnique: null,
            upsert: { id: 1, name: "S101" },
        }),
        teacher: createModel({
            findMany: [] as unknown[],
            upsert: { id: 1, name: "Hugel T." },
        }),
        content: createModel({
            upsert: { id: 1, code: "R1.01", name: "Initiation au développement" },
        }),
        student_group: createModel({
            upsert: { id: 1, main_group: 1, sub_group: 1 },
        }),
        edt_index: createModel({
            findFirst: null,
            create: { id: 1 },
            update: { id: 1 },
            deleteMany: { count: 0 },
        }),
    };
}

function createStatsModels() {
    return {
        users: createModel({
            findUnique: null,
            create: { id: 1 },
            update: { id: 1 },
        }),
        requests: createModel({
            create: { id: 1 },
        }),
    };
}

export const prismaEdtMock = createEdtModels();
export const prismaStatsMock = createStatsModels();

/** Rend aux deux clients des mocks neufs (implémentations et historique d'appels). */
export function resetPrismaMocks(): void {
    Object.assign(prismaEdtMock, createEdtModels());
    Object.assign(prismaStatsMock, createStatsModels());
}
