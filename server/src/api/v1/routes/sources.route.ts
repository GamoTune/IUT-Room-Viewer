// ============================================
// 📁 src/api/v1/routes/sources.route.ts
// Routes des documents publiés
// ============================================

import { Router } from "express";
import { SourceController } from "../../../controllers/source.controller.js";

const router = Router();

/**
 * GET /api/v1/sources
 * Documents de l'IUT pour un groupe et une semaine
 */
router.get("/", (req, res) => SourceController.instance.getWeek(req, res));

export { router as sourceRoutes };
