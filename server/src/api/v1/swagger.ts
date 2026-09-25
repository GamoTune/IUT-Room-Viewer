// ============================================
// 📁 src/api/v1/swagger.ts
// Documentation OpenAPI de l'API v1
// ============================================

import { errorResponse, okResponse, pick } from "../schemas.js";

/** Fenêtre temporelle, commune aux routes qui en prennent une. */
const windowParams = [
    {
        name: "startTime",
        in: "query",
        required: true,
        description: "Début de la fenêtre, en ISO 8601.",
        schema: { type: "string", format: "date-time" },
        example: "2026-09-10T09:30:00.000Z",
    },
    {
        name: "endTime",
        in: "query",
        required: true,
        description:
            "Fin de la fenêtre. **Égale à `startTime` pour interroger un instant** : une salle est alors occupée si un cours est en cours à cette seconde précise.",
        schema: { type: "string", format: "date-time" },
        example: "2026-09-10T11:30:00.000Z",
    },
];

export const swaggerDocument = {
    openapi: "3.0.3",
    info: {
        title: "IUT Room Viewer — API v1",
        version: "1.0.0",
        description: [
            "Salles et emplois du temps du département informatique de l'IUT du Limousin.",
            "",
            "**Lecture libre, sans authentification.** Seules l'écriture — déclencher une",
            "synchronisation, journaliser une commande du bot — demande une clé, passée en",
            "en-tête `X-API-Key`.",
            "",
            "### D'où viennent les données",
            "",
            "Uniquement des emplois du temps **de promotion** publiés en PDF par l'IUT",
            "(`A1_S1.pdf`), relus plusieurs fois par jour. Les fichiers par groupe et les",
            "`.ics` de l'IUT ne sont pas exploités : leurs attributions de groupe se sont",
            "révélées fausses et des cours y manquent.",
            "",
            "Une conséquence pratique : les documents n'écrivent pas le type de séance, il",
            "est déduit de la portée de la case — un cours couvrant toute une promotion est",
            "un CM, un groupe entier un TD, un demi-groupe un TP.",
            "",
            "### Fuseau horaire",
            "",
            "Toutes les dates sont en UTC (`Z`). Les emplois du temps sont publiés en heure",
            "de Paris et convertis à la lecture, changements d'heure compris.",
            "",
            "### Voir aussi",
            "",
            "L'API v2 (`/docs/v2`) expose les cours sous une forme mise à plat, plus simple",
            "à afficher.",
        ].join("\n"),
    },
    servers: [{ url: "/", description: "Serveur courant" }],
    tags: [
        { name: "Général", description: "État du service" },
        { name: "Salles", description: "Référentiel et occupation" },
        { name: "Groupes", description: "Groupes publiés par l'IUT" },
        { name: "Documents", description: "Emplois du temps tels que l'IUT les publie" },
        { name: "Emploi du temps", description: "Emploi du temps d'un groupe" },
        { name: "Synchronisation", description: "Relecture des documents de l'IUT" },
        { name: "Statistiques", description: "Journal d'usage du bot Discord" },
    ],

    paths: {
        "/health": {
            get: {
                tags: ["Général"],
                summary: "État du service",
                description: "Répond même quand la base est injoignable : sert à vérifier que le processus tourne.",
                responses: {
                    "200": {
                        description: "Le service répond",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        status: { type: "string", example: "ok" },
                                        version: { type: "string", example: "5.0.0" },
                                        uptime: { type: "number", description: "Secondes depuis le démarrage.", example: 1050 },
                                        timestamp: { type: "string", format: "date-time" },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },

        "/api/v1/rooms": {
            get: {
                tags: ["Salles"],
                summary: "Lister les salles",
                description:
                    "Le référentiel complet, dans l'ordre d'affichage (étage puis `displayOrder`). Il ne dit rien de l'occupation : voir `/api/v1/rooms/availability`.",
                responses: { "200": okResponse("Les salles du département", "RoomListResponse") },
            },
        },

        "/api/v1/rooms/availability": {
            get: {
                tags: ["Salles"],
                summary: "Occupation des salles sur une période",
                description: [
                    "Rend **toutes** les salles, y compris libres : une salle sans cours porte une",
                    "liste `lessons` vide — c'est une information, pas une absence.",
                    "",
                    "Un cours est retenu dès qu'il chevauche la fenêtre, même partiellement. Pour",
                    "savoir quelles salles sont libres sur *toute* une plage, il suffit donc de",
                    "garder celles dont `lessons` est vide.",
                    "",
                    "`R46` et `R47` sont physiquement les mêmes locaux : un cours dans l'une",
                    "occupe l'autre. L'API les rend séparément, au client de les fusionner s'il",
                    "le souhaite.",
                ].join("\n"),
                parameters: windowParams,
                responses: {
                    "200": okResponse("Les salles et ce qui les occupe", "RoomAvailabilityResponse"),
                    "400": errorResponse("`startTime` ou `endTime` manquant"),
                },
            },
        },

        "/api/v1/groups": {
            get: {
                tags: ["Groupes"],
                summary: "Lister les groupes",
                description:
                    "Les groupes tels que l'IUT les publie. Leur `code` est ce qu'attend le filtre `groups` de `/api/v2/courses` : ne pas les coder en dur, ils changent d'une année à l'autre.",
                responses: { "200": okResponse("Les groupes connus", "GroupListResponse") },
            },
        },

        "/api/v1/sources": {
            get: {
                tags: ["Documents"],
                summary: "Documents de l'IUT pour un groupe et une semaine",
                description: [
                    "Les emplois du temps tels que l'IUT les publie, pour le sous-groupe, le groupe",
                    "et l'année d'un groupe. Les adresses pointent chez l'IUT.",
                    "",
                    "**L'IUT ne publie de `.ics` que pour les sous-groupes** : les emplacements ICS",
                    "du groupe et de l'année sont toujours vides. Les documents de groupe arrivent",
                    "aussi souvent plus tard que celui de l'année.",
                    "",
                    "Rappel : seul le document d'année alimente cette API. Ceux des groupes et les",
                    "`.ics` sont listés pour qui veut les consulter, mais leur contenu n'est pas fiable.",
                ].join("\n"),
                parameters: [
                    {
                        name: "group",
                        in: "query",
                        required: true,
                        description: "Code de groupe, tel que rendu par `/api/v1/groups`.",
                        schema: { type: "string" },
                        example: "G8a",
                    },
                    {
                        name: "start_at",
                        in: "query",
                        required: true,
                        description: "Début de la semaine, en ISO 8601. La période couvre les sept jours qui suivent.",
                        schema: { type: "string", format: "date-time" },
                        example: "2026-09-06T22:00:00.000Z",
                    },
                ],
                responses: {
                    "200": okResponse("Les six emplacements de la semaine", "WeekSourcesResponse"),
                    "400": errorResponse("`group` ou `start_at` manquant ou illisible"),
                    "404": errorResponse("Groupe inconnu"),
                },
            },
        },

        "/api/v1/schedule": {
            get: {
                tags: ["Emploi du temps"],
                summary: "Emploi du temps d'un groupe, pour une journée",
                description:
                    "Forme héritée du bot Discord. Pour une semaine ou un affichage en grille, préférer `/api/v2/courses`, qui rend les mêmes cours avec leurs salles multiples.",
                parameters: [
                    {
                        name: "group",
                        in: "query",
                        required: true,
                        description: "Numéro de groupe. L'année s'en déduit.",
                        schema: { type: "string" },
                        example: "G8",
                    },
                    {
                        name: "tp",
                        in: "query",
                        required: false,
                        description: "Sous-groupe, `A` ou `B`.",
                        schema: { type: "string", enum: ["A", "B"] },
                    },
                    {
                        name: "date",
                        in: "query",
                        required: false,
                        description: "Jour consulté (`AAAA-MM-JJ`). Aujourd'hui par défaut.",
                        schema: { type: "string", format: "date" },
                    },
                ],
                responses: {
                    "200": {
                        description: "L'emploi du temps du jour",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean", example: true },
                                        data: {
                                            type: "object",
                                            properties: {
                                                group: { type: "string", example: "G8" },
                                                year: {
                                                    type: "string",
                                                    description:
                                                        "Nommée `BUT1`/`BUT2`/`BUT3` sur cette route, contrairement au reste de l'API.",
                                                    example: "BUT3",
                                                },
                                                tp: { type: "string", nullable: true, example: "A" },
                                                date: { type: "string", format: "date", example: "2026-09-10" },
                                                courses: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            id: { type: "integer" },
                                                            code: { type: "string", example: "R5A.14" },
                                                            title: { type: "string", example: "Anglais" },
                                                            startTime: { type: "string", format: "date-time" },
                                                            endTime: { type: "string", format: "date-time" },
                                                            room: {
                                                                type: "string",
                                                                description:
                                                                    "Salles réunies en une chaîne, contrairement à la v2.",
                                                                example: "111, 112",
                                                            },
                                                            teacher: { type: "string", nullable: true },
                                                            type: {
                                                                type: "string",
                                                                enum: ["CM", "TD", "TP", "DS", "SAE", "Autre"],
                                                                description:
                                                                    "Nomenclature propre à cette route, distincte de celle des autres.",
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "400": errorResponse("`group` manquant"),
                },
            },
        },

        "/api/v1/sync/status": {
            get: {
                tags: ["Synchronisation"],
                summary: "Où en est la synchronisation",
                description:
                    "`lastSync` vaut `null` tant qu'aucune synchronisation n'a eu lieu depuis le démarrage : le bilan n'est pas conservé en base.",
                responses: { "200": okResponse("État courant", "SyncStatusResponse") },
            },
        },

        "/api/v1/sync/trigger": {
            post: {
                tags: ["Synchronisation"],
                summary: "Déclencher une synchronisation",
                security: [{ ApiKey: [] }],
                description: [
                    "Relit les documents de l'IUT et alimente la base. Les documents inchangés",
                    "depuis le dernier passage sont sautés — l'IUT répond alors 304.",
                    "",
                    "L'appel est **synchrone** : il rend la main une fois la synchronisation finie,",
                    "ce qui prend quelques secondes.",
                ].join("\n"),
                responses: {
                    "200": okResponse("Bilan du passage", "SyncSummaryResponse"),
                    "401": errorResponse("Clé absente ou invalide"),
                    "409": errorResponse("Une synchronisation est déjà en cours"),
                    "500": errorResponse("La synchronisation a échoué"),
                },
            },
        },

        "/api/v1/sync/reset": {
            post: {
                tags: ["Synchronisation"],
                summary: "Reprendre la synchronisation depuis zéro",
                security: [{ ApiKey: [] }],
                description:
                    "Comme `/trigger`, mais en ignorant les en-têtes de cache : tous les documents sont retéléchargés et relus, même inchangés. À réserver aux cas où la lecture elle-même a changé.",
                responses: {
                    "200": okResponse("Bilan du passage", "SyncSummaryResponse"),
                    "401": errorResponse("Clé absente ou invalide"),
                    "500": errorResponse("La reprise a échoué"),
                },
            },
        },

        "/api/v1/stats/log": {
            post: {
                tags: ["Statistiques"],
                summary: "Journaliser une commande du bot",
                security: [{ ApiKey: [] }],
                description: "Réservé au bot Discord. Enregistre l'usage d'une commande et rafraîchit le pseudo de son auteur.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["discordUserId", "username", "command"],
                                properties: {
                                    discordUserId: { type: "string", example: "123456789012345678" },
                                    username: { type: "string", example: "bobbynou" },
                                    globalName: { type: "string", nullable: true, example: "Bobby" },
                                    command: { type: "string", example: "/salles_maintenant" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Commande enregistrée" },
                    "400": errorResponse("Champ obligatoire manquant"),
                    "401": errorResponse("Clé absente ou invalide"),
                },
            },
        },
    },

    components: {
        securitySchemes: {
            ApiKey: {
                type: "apiKey",
                in: "header",
                name: "X-API-Key",
                description: "Clé d'administration. Sans elle, ces routes répondent 401.",
            },
        },
        schemas: pick(
            "ErrorResponse",
            "RoomListResponse",
            "RoomAvailabilityResponse",
            "GroupListResponse",
            "WeekSourcesResponse",
            "SyncStatusResponse",
            "SyncSummaryResponse",
        ),
    },
} as const;
