// ============================================
// 📁 src/api/app.ts
// Configuration de l'application Express
// ============================================

import express from "express";
import swaggerUi from "swagger-ui-express";

// Import des routes v1
import { roomRoutes } from "./v1/index.js";
import { syncRoutes } from "./v1/index.js";
import { scheduleRoutes } from "./v1/index.js";
import { statsRoutes } from "./v1/index.js";


// Import des routes v2
// Importer les routes V2
import { roomRoutes as v2RoomRoutes } from "./v2/index.js";
import { syncRoutes as v2SyncRoutes } from "./v2/index.js";



// Importer la documentation Swagger
import { swaggerDocument } from "./swagger.js";

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

// Route de santé (pour vérifier que le serveur fonctionne)
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Documentation Swagger (routes publiques uniquement)
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "IUT Room Viewer API - Documentation",
}));

// Page d'accueil de l'API
app.get("/", (_req, res) => {
    res.json({
        name: "IUT Room Viewer API",
        version: process.env.VERSION,
        documentation: "/docs",
        endpoints: {
            health: "/health",
            docs: "/docs",
            rooms: "/api/v1/rooms",
            sync: "/api/v1/sync",
            schedule: "/api/v1/schedule",
            stats: "/api/v1/stats",
        },
    });
});

// Monter les routes des salles
app.use("/api/v1/rooms", roomRoutes);

// Monter les routes de synchronisation
app.use("/api/v1/sync", syncRoutes);

// Monter les routes du planning
app.use("/api/v1/schedule", scheduleRoutes);

// Monter les routes des statistiques
app.use("/api/v1/stats", statsRoutes);

// ============================================
// Gestion des erreurs (doit être à la fin)
// ============================================
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Erreur:", err.message);
    res.status(500).json({
        success: false,
        error: "Erreur interne du serveur",
    });
});

export { app };
