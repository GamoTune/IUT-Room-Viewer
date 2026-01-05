// ============================================
// 📁 src/api/routes/schedule.route.ts
// Routes Express pour les salles
// ============================================

import { Router } from "express";

// On importe le contrôleur
import { getSchedule } from '../../controllers/schedule.controller.js';

// Créer un routeur Express
const router = Router();

// ============================================
// Définition des routes
// ============================================

// Schedule routes
router.get('/', getSchedule);

export { router as scheduleRoutes };