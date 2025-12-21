// ============================================
// 📁 src/api/routes/sync.routes.ts
// Routes Express pour la synchronisation
// ============================================

import { Router } from "express";
import { SyncController } from "../../controllers/sync.controller.js";

const router = Router();

// ============================================
// Définition des routes
// ============================================


// POST /api/v1/sync/trigger - Déclenche une synchronisation manuelle
router.post("/trigger", (req, res) => SyncController.instance.triggerSync(req, res));

// GET /api/v1/sync/status - Récupère le statut de la synchronisation
router.get("/status", (req, res) => SyncController.instance.getStatus(req, res));

export { router as syncRoutes };
