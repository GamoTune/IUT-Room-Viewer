// ============================================
// 📁 src/api/app.ts
// Configuration de l'application Express
// ============================================

import express from "express";

// Importer les routes
import { roomRoutes } from "./routes/rooms.route.js";
import { syncRoutes } from "./routes/sync.route.js";
import { scheduleRoutes } from "./routes/schedule.route.js";
import { statsRoutes } from "./routes/stats.route.js";

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

// Page d'accueil de l'API
app.get("/", (_req, res) => {
    res.json({
        name: "IUT Room Viewer API",
        version: process.env.VERSION,
        endpoints: {
            health: "/health",
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
