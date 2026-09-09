// ============================================
// 📁 src/api/app.ts
// Configuration de l'application Express
// ============================================

import express from "express";
import swaggerUi from "swagger-ui-express";

// Import des routes v1
import { groupRoutes } from "./v1/index.js";
import { roomRoutes } from "./v1/index.js";
import { syncRoutes } from "./v1/index.js";
import { scheduleRoutes } from "./v1/index.js";
import { statsRoutes } from "./v1/index.js";


// Import des routes v2
import { courseRoutes } from "./v2/routes/courses.route.js";



// Importer les documentations Swagger v1 et v2
import { swaggerDocument as swaggerDocumentV1 } from "./v1/swagger.js";
import { swaggerDocumentV2 } from "./v2/swagger.js";

// Créer l'application Express
const app = express();

// ============================================
// Middlewares
// ============================================

// Parser le JSON dans les requêtes
app.use(express.json());

// Parser les données de formulaire
app.use(express.urlencoded({ extended: true }));

// CORS simple (permet les requêtes depuis d'autres origines)
app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});

// ============================================
// Routes
// ============================================


// =========== Routes Générales ===============


// Route de santé (pour vérifier que le serveur fonctionne)
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        version: process.env.VERSION,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Documentation Swagger v1
app.use("/docs/v1", swaggerUi.serveFiles(swaggerDocumentV1), swaggerUi.setup(swaggerDocumentV1, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "IUT Room Viewer API v1 - Documentation",
}));

// Documentation Swagger v2
app.use("/docs/v2", swaggerUi.serveFiles(swaggerDocumentV2), swaggerUi.setup(swaggerDocumentV2, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "IUT Room Viewer API v2 - Documentation",
}));

// Redirection /docs vers la dernière version (v2)
app.get("/docs", (_req, res) => {
    res.redirect("/docs/v2");
});

// Page d'accueil de l'API
app.get("/", (_req, res) => {
    res.json({
        name: "IUT Room Viewer API",
        version: process.env.VERSION,
        documentation: {
            v1: "/docs/v1",
            v2: "/docs/v2",
            latest: "/docs",
        },
        endpoints: {
            health: "/health",
            v1: {
                rooms: "/api/v1/rooms",
                sync: "/api/v1/sync",
                schedule: "/api/v1/schedule",
                stats: "/api/v1/stats",
            },
            v2: {
                courses: "/api/v2/courses",
            },
        },
    });
});


// ============= Routes v1 ====================

app.use("/api/v1/rooms", roomRoutes);
app.use("/api/v1/groups", groupRoutes);
app.use("/api/v1/sync", syncRoutes);
app.use("/api/v1/schedule", scheduleRoutes);
app.use("/api/v1/stats", statsRoutes);


// ============= Routes v2 ====================

app.use("/api/v2/courses", courseRoutes);


// ============================================
// Gestion des erreurs
// ============================================
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Erreur:", err.message);
    res.status(500).json({
        success: false,
        error: "Erreur interne du serveur",
    });
});

export { app };
