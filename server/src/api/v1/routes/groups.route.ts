// ============================================
// 📁 src/api/v1/routes/groups.route.ts
// Routes des groupes
// ============================================

import { Router } from "express";
import { GroupController } from "../../../controllers/group.controller.js";

const router = Router();

/**
 * GET /api/v1/groups
 * Liste tous les groupes
 */
router.get("/", (req, res) => GroupController.instance.getAll(req, res));

export { router as groupRoutes };
