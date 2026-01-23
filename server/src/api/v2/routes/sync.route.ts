// ============================================
// 📁 src/api/routes/rooms.routes.ts
// Routes Express pour les salles
// ============================================

import { Router } from "express";


// Créer un routeur Express
const router = Router();

// ============================================
// Définition des routes
// ============================================

// POST /api/v2/sync/trigger - Déclenche une synchronisation manuelle
router.get("/trigger", (req, res) => {});

// POST /api/v2/sync/reset - Réinitialise la synchronisation
router.get("/reset", (req, res) => {});

// GET /api/v1/sync/status - Récupère le statut de la synchronisation
router.get("/status", (req, res) => {});

// Exporter le routeur
export { router as syncRoutes };