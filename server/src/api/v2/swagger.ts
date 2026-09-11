// ============================================
// 📁 src/api/v2/swagger.ts
// Documentation OpenAPI de l'API v2
// ============================================

import { errorResponse, okResponse, pick } from "../schemas.js";

export const swaggerDocumentV2 = {
    openapi: "3.0.3",
    info: {
        title: "IUT Room Viewer — API v2",
        version: "2.0.0",
        description: [
            "Les cours du département informatique de l'IUT du Limousin, mis à plat.",
            "",
            "**Lecture libre, sans authentification.**",
            "",
            "### Ce que la v2 change",
            "",
            "La v1 rend les cours *par salle*, avec des groupes sous forme numérique",
            "(`{ mainGroup: -1, subGroup: -1 }`) qu'il faut savoir interpréter. La v2 rend",
            "une liste de cours déjà lisibles : groupes nommés (`A1`, `G8`, `G8A`), salles",
            "en clair, dates ISO.",
            "",
            "La v1 reste la seule à exposer le référentiel des salles, leur occupation et",
            "les groupes : voir `/docs/v1`.",
            "",
            "### D'où viennent les données",
            "",
            "Uniquement des emplois du temps **de promotion** publiés en PDF par l'IUT,",
            "relus plusieurs fois par jour. Les fichiers par groupe et les `.ics` ne sont",
            "pas exploités : leurs attributions de groupe se sont révélées fausses.",
            "",
            "Toutes les dates sont en UTC (`Z`).",
        ].join("\n"),
    },
    servers: [{ url: "/", description: "Serveur courant" }],
    tags: [{ name: "Cours", description: "Consultation des cours" }],

    paths: {
        "/api/v2/courses": {
            get: {
                tags: ["Cours"],
                summary: "Lister les cours d'une période",
                description: [
                    "Rend les cours **entièrement contenus** dans la fenêtre demandée : un cours",
                    "qui la chevauche sans y tenir n'apparaît pas. Demander la semaine entière",
                    "plutôt qu'une journée pour ne rien manquer aux bords.",
                    "",
                    "Les filtres se cumulent. Chacun accepte plusieurs valeurs séparées par des",
                    "virgules.",
                    "",
                    "Un filtre `groups` rend aussi les cours de niveau supérieur : demander `G8a`",
                    "retourne ses TP, les TD de `G8` et les CM de sa promotion.",
                ].join("\n"),
                parameters: [
                    {
                        name: "start_at",
                        in: "query",
                        required: true,
                        description: "Début de la fenêtre, en ISO 8601.",
                        schema: { type: "string", format: "date-time" },
                        example: "2026-09-07T00:00:00.000Z",
                    },
                    {
                        name: "end_at",
                        in: "query",
                        required: true,
                        description: "Fin de la fenêtre, en ISO 8601.",
                        schema: { type: "string", format: "date-time" },
                        example: "2026-09-14T00:00:00.000Z",
                    },
                    {
                        name: "groups",
                        in: "query",
                        required: false,
                        description:
                            "Codes de groupes, tels que rendus par `/api/v1/groups`. Ne pas les coder en dur : ils changent d'une année à l'autre.",
                        schema: { type: "string" },
                        example: "G8a,G8b",
                    },
                    {
                        name: "rooms",
                        in: "query",
                        required: false,
                        description: "Noms de salles, tels que rendus par `/api/v1/rooms`.",
                        schema: { type: "string" },
                        example: "R52,112",
                    },
                    {
                        name: "teachers",
                        in: "query",
                        required: false,
                        description: [
                            "Enseignants. Un même enseignant est désigné tantôt par un code (`CO`),",
                            "tantôt par un nom (`Onete C.`), sans lien entre les deux dans les",
                            "documents : envoyer les deux formes, l'API réunit ce qui correspond.",
                            "La correspondance exacte prime ; à défaut, une correspondance partielle",
                            "sur le nom est acceptée, accents et casse ignorés.",
                            "",
                            "Aucune forme reconnue rend une liste vide, et non toutes les données.",
                        ].join(" "),
                        schema: { type: "string" },
                        example: "CO,Onete C.",
                    },
                ],
                responses: {
                    "200": okResponse("Les cours de la période", "CoursesResponse"),
                    "400": errorResponse("`start_at` ou `end_at` manquant"),
                    "500": errorResponse("Erreur lors de la récupération"),
                },
            },
        },
    },

    components: { schemas: pick("ErrorResponse", "CoursesResponse") },
} as const;
