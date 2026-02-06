// ============================================
// 📁 src/api/v1/routes/courses.routes.ts
// Routes Express pour les salles
// ============================================

import { Router } from "express";
import { CourseController } from "../../../controllers/course.controller.js";


// Créer un routeur Express
const router = Router();

// ============================================
// Définition des routes
// ============================================

// GET /api/v2/courses - Liste des cours
router.get("/", (req, res) => CourseController.instance.getCourses(req, res));

// Exporter le routeur
export { router as courseRoutes };