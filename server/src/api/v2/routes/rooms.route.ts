// ============================================
// 📁 src/api/v1/routes/rooms.routes.ts
// Routes Express pour les salles
// ============================================

import { Router } from "express";


// Créer un routeur Express
const router = Router();

// ============================================
// Définition des routes
// ============================================

// GET /api/v2/rooms - Liste toutes les salles
router.get("/", (req, res) => {});

// GET /api/v2/rooms/status - Statut des salles
router.get("/status", (req, res) => {});

// Exporter le routeur
export { router as roomRoutes };