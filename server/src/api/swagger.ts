// ============================================
// 📁 src/api/swagger.ts
// Configuration Swagger pour la documentation API
// ============================================

export const swaggerDocument = {
    openapi: "3.0.3",
    info: {
        title: "IUT Room Viewer API",
        description: "API publique pour consulter les salles et emplois du temps de l'IUT",
        version: "2.0.0",
        contact: {
            name: "IUT Room Viewer",
        },
    },
    servers: [
        {
            url: "/",
            description: "Serveur actuel",
        },
    ],
    tags: [
        {
            name: "Général",
            description: "Endpoints généraux",
        },
        {
            name: "Salles",
            description: "Gestion et disponibilité des salles",
        },
        {
            name: "Emploi du temps",
            description: "Consultation des emplois du temps",
        },
        {
            name: "Synchronisation",
            description: "Statut de synchronisation des données",
        },
    ],
    paths: {
        "/": {
            get: {
                tags: ["Général"],
                summary: "Page d'accueil de l'API",
                description: "Retourne les informations de base de l'API et la liste des endpoints disponibles",
                responses: {
                    "200": {
                        description: "Informations de l'API",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        name: {
                                            type: "string",
                                            example: "IUT Room Viewer API",
                                        },
                                        version: {
                                            type: "string",
                                            example: "2.0.0",
                                        },
                                        documentation: {
                                            type: "string",
                                            example: "/docs",
                                        },
                                        endpoints: {
                                            type: "object",
                                            properties: {
                                                health: { type: "string", example: "/health" },
                                                docs: { type: "string", example: "/docs" },
                                                rooms: { type: "string", example: "/api/v1/rooms" },
                                                sync: { type: "string", example: "/api/v1/sync" },
                                                schedule: { type: "string", example: "/api/v1/schedule" },
                                                stats: { type: "string", example: "/api/v1/stats" },
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
        "/docs": {
            get: {
                tags: ["Général"],
                summary: "Documentation Swagger",
                description: "Interface interactive Swagger UI pour explorer et tester l'API publique",
                responses: {
                    "200": {
                        description: "Page de documentation Swagger UI",
                        content: {
                            "text/html": {
                                schema: {
                                    type: "string",
                                },
                            },
                        },
                    },
                },
            },
        },
        "/health": {
            get: {
                tags: ["Général"],
                summary: "Vérification de santé du serveur",
                description: "Permet de vérifier que le serveur fonctionne correctement",
                responses: {
                    "200": {
                        description: "Le serveur fonctionne correctement",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        status: {
                                            type: "string",
                                            example: "ok",
                                        },
                                        uptime: {
                                            type: "number",
                                            description: "Temps de fonctionnement en secondes",
                                            example: 3600,
                                        },
                                        timestamp: {
                                            type: "string",
                                            format: "date-time",
                                            example: "2026-01-12T15:30:00.000Z",
                                        },
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
                summary: "Liste toutes les salles",
                description: "Récupère la liste complète des salles disponibles dans la base de données",
                responses: {
                    "200": {
                        description: "Liste des salles récupérée avec succès",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/RoomListResponse",
                                },
                            },
                        },
                    },
                    "500": {
                        description: "Erreur serveur",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/ErrorResponse",
                                },
                            },
                        },
                    },
                },
            },
        },
        "/api/v1/rooms/availability": {
            get: {
                tags: ["Salles"],
                summary: "Disponibilité des salles",
                description: "Récupère la disponibilité des salles sur une plage horaire donnée, avec les cours associés",
                parameters: [
                    {
                        name: "startTime",
                        in: "query",
                        required: true,
                        description: "Date/heure de début (format ISO 8601)",
                        schema: {
                            type: "string",
                            format: "date-time",
                        },
                        example: "2026-01-12T08:00:00.000Z",
                    },
                    {
                        name: "endTime",
                        in: "query",
                        required: true,
                        description: "Date/heure de fin (format ISO 8601)",
                        schema: {
                            type: "string",
                            format: "date-time",
                        },
                        example: "2026-01-12T18:00:00.000Z",
                    },
                ],
                responses: {
                    "200": {
                        description: "Disponibilité des salles récupérée avec succès",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/RoomAvailabilityResponse",
                                },
                            },
                        },
                    },
                    "400": {
                        description: "Paramètres manquants ou invalides",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/ErrorResponse",
                                },
                            },
                        },
                    },
                    "500": {
                        description: "Erreur serveur",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/ErrorResponse",
                                },
                            },
                        },
                    },
                },
            },
        },
        "/api/v1/schedule": {
            get: {
                tags: ["Emploi du temps"],
                summary: "Emploi du temps d'un groupe",
                description: "Récupère l'emploi du temps d'un groupe pour une date donnée",
                parameters: [
                    {
                        name: "group",
                        in: "query",
                        required: true,
                        description: "Numéro du groupe (G1-G3 pour BUT1, G4-G5 pour BUT2, G7-G8 pour BUT3). L'année est déduite automatiquement.",
                        schema: {
                            type: "string",
                        },
                        example: "G3",
                    },
                    {
                        name: "tp",
                        in: "query",
                        required: false,
                        description: "Sous-groupe de TP (ex: A, B)",
                        schema: {
                            type: "string",
                        },
                        example: "A",
                    },
                    {
                        name: "date",
                        in: "query",
                        required: false,
                        description: "Date pour laquelle récupérer l'emploi du temps (format ISO). Par défaut: aujourd'hui",
                        schema: {
                            type: "string",
                            format: "date",
                        },
                        example: "2026-01-12",
                    },
                ],
                responses: {
                    "200": {
                        description: "Emploi du temps récupéré avec succès",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/ScheduleResponse",
                                },
                            },
                        },
                    },
                    "400": {
                        description: "Paramètres manquants ou invalides",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/ErrorResponse",
                                },
                            },
                        },
                    },
                    "500": {
                        description: "Erreur serveur",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/ErrorResponse",
                                },
                            },
                        },
                    },
                },
            },
        },
        "/api/v1/sync/status": {
            get: {
                tags: ["Synchronisation"],
                summary: "Statut de synchronisation",
                description: "Retourne le statut actuel de la synchronisation des données avec Unilim",
                responses: {
                    "200": {
                        description: "Statut récupéré avec succès",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/SyncStatusResponse",
                                },
                            },
                        },
                    },
                    "500": {
                        description: "Erreur serveur",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/ErrorResponse",
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    components: {
        schemas: {
            ApiResponse: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        description: "Indique si la requête a réussi",
                    },
                    data: {
                        description: "Données de la réponse (si succès)",
                    },
                    error: {
                        type: "string",
                        description: "Message d'erreur (si échec)",
                    },
                },
                required: ["success"],
            },
            ErrorResponse: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        example: false,
                    },
                    error: {
                        type: "string",
                        example: "Description de l'erreur",
                    },
                },
            },
            Room: {
                type: "object",
                properties: {
                    id: {
                        type: "integer",
                        example: 7,
                    },
                    name: {
                        type: "string",
                        example: "103",
                    },
                },
            },
            RoomListResponse: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        example: true,
                    },
                    data: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/Room",
                        },
                    },
                },
            },
            Lesson: {
                type: "object",
                properties: {
                    id: {
                        type: "integer",
                        example: 1,
                    },
                    type: {
                        type: "string",
                        example: "TD",
                    },
                    startTime: {
                        type: "string",
                        format: "date-time",
                        example: "2026-01-12T12:30:00.000Z",
                    },
                    endTime: {
                        type: "string",
                        format: "date-time",
                        example: "2026-01-12T14:30:00.000Z",
                    },
                    rooms: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                        example: ["111"],
                    },
                    teacher: {
                        type: "string",
                        nullable: true,
                        example: "AP",
                    },
                    contentCode: {
                        type: "string",
                        example: "R109",
                    },
                    contentName: {
                        type: "string",
                        example: "Projet professionnel et personnel",
                    },
                    groups: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                mainGroup: {
                                    type: "integer",
                                    example: 1,
                                },
                                subGroup: {
                                    type: "integer",
                                    example: 0,
                                },
                            },
                        },
                    },
                },
            },
            RoomWithLessons: {
                type: "object",
                properties: {
                    id: {
                        type: "integer",
                        example: 9,
                    },
                    name: {
                        type: "string",
                        example: "111",
                    },
                    lessons: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/Lesson",
                        },
                    },
                },
            },
            RoomAvailabilityResponse: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        example: true,
                    },
                    data: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/RoomWithLessons",
                        },
                    },
                },
            },
            Course: {
                type: "object",
                properties: {
                    id: {
                        type: "integer",
                        example: 4192,
                    },
                    code: {
                        type: "string",
                        example: "R1.09",
                    },
                    title: {
                        type: "string",
                        example: "Projet professionnel et personnel",
                    },
                    startTime: {
                        type: "string",
                        format: "date-time",
                        example: "2026-01-12T12:30:00.000Z",
                    },
                    endTime: {
                        type: "string",
                        format: "date-time",
                        example: "2026-01-12T14:30:00.000Z",
                    },
                    room: {
                        type: "string",
                        example: "111",
                    },
                    teacher: {
                        type: "string",
                        example: "AP",
                    },
                    type: {
                        type: "string",
                        enum: ["CM", "TD", "TP", "DS", "SAE", "Autre"],
                        example: "TD",
                    },
                },
            },
            ScheduleData: {
                type: "object",
                properties: {
                    group: {
                        type: "string",
                        example: "G3",
                    },
                    year: {
                        type: "string",
                        description: "Année déduite automatiquement du groupe",
                        example: "BUT1",
                    },
                    tp: {
                        type: "string",
                        example: "A",
                    },
                    date: {
                        type: "string",
                        format: "date",
                        example: "2026-01-12",
                    },
                    courses: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/Course",
                        },
                    },
                },
            },
            ScheduleResponse: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        example: true,
                    },
                    data: {
                        $ref: "#/components/schemas/ScheduleData",
                    },
                },
            },
            SyncStatus: {
                type: "object",
                properties: {
                    isRunning: {
                        type: "boolean",
                        description: "Indique si une synchronisation est en cours",
                        example: false,
                    },
                    lastSync: {
                        type: "string",
                        format: "date-time",
                        nullable: true,
                        description: "Date de la dernière synchronisation",
                        example: "2026-01-12T06:00:00.000Z",
                    },
                    lastError: {
                        type: "string",
                        nullable: true,
                        description: "Dernière erreur de synchronisation",
                        example: null,
                    },
                },
            },
            SyncStatusResponse: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        example: true,
                    },
                    data: {
                        $ref: "#/components/schemas/SyncStatus",
                    },
                },
            },
        },
    },
};
