// ============================================
// 📁 src/api/routes/stats.route.ts
// Routes pour les statistiques (logging des commandes bot)
// ============================================

import { Router } from "express";
import { requireApiKey } from "../../../middleware/auth.middleware.js";
import { logCommandController } from "../../../controllers/stats.controller.js";

const router = Router();

// POST /api/v1/stats/log - Log une commande du bot Discord
router.post("/log", requireApiKey, logCommandController);

export { router as statsRoutes };
