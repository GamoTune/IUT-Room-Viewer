// ============================================
// 📁 src/api/schemas.ts
// Schémas OpenAPI partagés par les deux versions de l'API
//
// Un seul endroit pour les décrire : les documents v1 et v2 portaient chacun
// leur copie, et elles avaient fini par diverger du code — salles réduites à
// `id` et `name`, types de séance inventés.
// ============================================

/** Enveloppe commune à toutes les réponses. */
const envelope = (data: object) => ({
    type: "object",
    properties: {
        success: { type: "boolean", example: true },
        data,
    },
});

export const schemas = {
    ErrorResponse: {
        type: "object",
        properties: {
            success: { type: "boolean", example: false },
            error: { type: "string", example: "Les paramètres startTime et endTime sont requis" },
        },
    },

    Room: {
        type: "object",
        description: "Une salle du référentiel. La liste est figée : une salle citée par l'IUT mais absente d'ici est signalée comme inconnue plutôt que créée.",
        properties: {
            id: { type: "integer", example: 7 },
            name: { type: "string", example: "103" },
            floor: { type: "integer", description: "0 pour le rez-de-chaussée.", example: 1 },
            kind: { type: "string", enum: ["salle", "amphi"], example: "salle" },
            displayOrder: {
                type: "integer",
                description: "Ordre d'affichage au sein de l'étage.",
                example: 70,
            },
            isActive: { type: "boolean", example: true },
        },
    },

    GroupRef: {
        type: "object",
        description:
            "Niveau réellement concerné par un cours. L'API réduit les sous-groupes : un cours suivi par toute une promotion n'est pas rendu comme six sous-groupes.",
        properties: {
            mainGroup: {
                type: "integer",
                description: "Numéro du groupe, ou **négatif pour une promotion entière** : `-1` = A1, `-2` = A2, `-3` = A3.",
                example: 8,
            },
            subGroup: {
                type: "integer",
                description: "`1` pour le sous-groupe A, `2` pour le B, `-1` pour le groupe entier.",
                enum: [-1, 1, 2],
                example: 1,
            },
        },
    },

    Lesson: {
        type: "object",
        properties: {
            id: { type: "integer", example: 1 },
            type: {
                type: "string",
                enum: ["CM", "TD", "TP", "SAE", "OTHER"],
                description:
                    "`SAE` désigne une situation d'apprentissage et d'évaluation, reconnue au préfixe du code (`S5A.01`). `OTHER` couvre ce que le document ne qualifie pas.",
                example: "TD",
            },
            startTime: { type: "string", format: "date-time", example: "2026-09-10T06:00:00.000Z" },
            endTime: { type: "string", format: "date-time", example: "2026-09-10T08:00:00.000Z" },
            rooms: {
                type: "array",
                description: "Un cours peut occuper deux salles à la fois.",
                items: { type: "string" },
                example: ["111", "112"],
            },
            teacher: { type: "string", nullable: true, example: "JP" },
            contentCode: { type: "string", example: "R5A.14" },
            contentName: { type: "string", example: "Anglais" },
            groups: { type: "array", items: { $ref: "#/components/schemas/GroupRef" } },
        },
    },

    RoomWithLessons: {
        type: "object",
        properties: {
            id: { type: "integer", example: 7 },
            name: { type: "string", example: "103" },
            lessons: {
                type: "array",
                description: "Vide quand la salle est libre sur toute la période demandée.",
                items: { $ref: "#/components/schemas/Lesson" },
            },
        },
    },

    Group: {
        type: "object",
        properties: {
            code: {
                type: "string",
                description: "Code publié par l'IUT, à reprendre tel quel dans le filtre `groups`.",
                example: "G8a",
            },
            label: { type: "string", description: "Libellé d'affichage.", example: "G8A" },
            year: { type: "string", enum: ["A1", "A2", "A3"], example: "A3" },
            mainGroup: { type: "integer", example: 8 },
            subGroup: { type: "string", nullable: true, enum: ["a", "b", null], example: "a" },
        },
    },

    Course: {
        type: "object",
        description: "Un cours, mis à plat pour l'affichage.",
        properties: {
            code: { type: "string", example: "R5A.14" },
            title: { type: "string", example: "Anglais" },
            type: { type: "string", enum: ["CM", "TD", "TP", "SAE", "OTHER"], example: "TP" },
            rooms: { type: "array", items: { type: "string" }, example: ["R52"] },
            groups: {
                type: "array",
                description: "Niveaux concernés, déjà nommés : `A1`, `G8`, `G8A`.",
                items: { type: "string" },
                example: ["G8A"],
            },
            teacher: { type: "string", description: "`Inconnu` quand le document n'en cite pas.", example: "JP" },
            start_at: { type: "string", format: "date-time", example: "2026-09-10T09:30:00.000Z" },
            end_at: { type: "string", format: "date-time", example: "2026-09-10T11:30:00.000Z" },
        },
    },

    SyncSummary: {
        type: "object",
        properties: {
            success: { type: "boolean", example: true },
            startedAt: { type: "string", format: "date-time" },
            completedAt: { type: "string", format: "date-time" },
            filesDiscovered: { type: "integer", example: 9 },
            filesDownloaded: { type: "integer", example: 9 },
            filesSkipped: { type: "integer", description: "Documents inchangés depuis le dernier passage (304).", example: 0 },
            lessonsCreated: { type: "integer", example: 284 },
            lessonsLinked: { type: "integer", example: 654 },
            unreadableCells: { type: "array", items: { type: "string" } },
            unknownRooms: {
                type: "array",
                description: "Salles citées par l'IUT mais absentes du référentiel.",
                items: { type: "string" },
            },
            errors: { type: "array", items: { type: "string" } },
        },
    },

    SyncStatus: {
        type: "object",
        properties: {
            isRunning: { type: "boolean", example: false },
            lastSync: { allOf: [{ $ref: "#/components/schemas/SyncSummary" }], nullable: true },
        },
    },

    RoomListResponse: envelope({ type: "array", items: { $ref: "#/components/schemas/Room" } }),
    RoomAvailabilityResponse: envelope({
        type: "array",
        items: { $ref: "#/components/schemas/RoomWithLessons" },
    }),
    GroupListResponse: envelope({ type: "array", items: { $ref: "#/components/schemas/Group" } }),
    CoursesResponse: envelope({ type: "array", items: { $ref: "#/components/schemas/Course" } }),
    SyncStatusResponse: envelope({ $ref: "#/components/schemas/SyncStatus" }),
    SyncSummaryResponse: envelope({ $ref: "#/components/schemas/SyncSummary" }),
} as const;

/**
 * Sous-ensemble des schémas réellement utilisé par un document, dépendances
 * comprises. Sans ce tri, la v2 afficherait les salles et la synchronisation,
 * qu'elle ne documente pas.
 */
export function pick(...racines: (keyof typeof schemas)[]): Record<string, unknown> {
    const retenus: Record<string, unknown> = {};
    const àVoir = [...racines];

    while (àVoir.length > 0) {
        const nom = àVoir.pop()!;
        if (nom in retenus) continue;

        const schéma = schemas[nom];
        retenus[nom] = schéma;

        // Les dépendances se lisent dans les `$ref` du schéma lui-même.
        for (const [, dépendance] of JSON.stringify(schéma).matchAll(/#\/components\/schemas\/([A-Za-z]+)/g)) {
            àVoir.push(dépendance as keyof typeof schemas);
        }
    }

    return retenus;
}

/** Réponse d'erreur, à reprendre dans chaque route. */
export const errorResponse = (description: string) => ({
    description,
    content: {
        "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
    },
});

/** Réponse nominale renvoyant l'un des schémas ci-dessus. */
export const okResponse = (description: string, schema: string) => ({
    description,
    content: {
        "application/json": { schema: { $ref: `#/components/schemas/${schema}` } },
    },
});
