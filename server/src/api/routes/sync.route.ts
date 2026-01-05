// ============================================
// 📁 src/api/routes/sync.routes.ts
// Routes Express pour la synchronisation
// ============================================

import { Router } from "express";
import { SyncController } from "../../controllers/sync.controller.js";
import { requireApiKey } from "../../middleware/auth.middleware.js";

const router = Router();

// ============================================
// Définition des routes
// ============================================


// POST /api/v1/sync/trigger - Déclenche une synchronisation manuelle
router.post("/trigger", requireApiKey, (req, res) => SyncController.instance.triggerSync(req, res));

router.post("/reset", requireApiKey, (req, res) => SyncController.instance.resetSync(req, res));

// GET /api/v1/sync/status - Récupère le statut de la synchronisation
router.get("/status", (req, res) => SyncController.instance.getStatus(req, res));

export { router as syncRoutes };
