// ============================================
// 📁 src/api/routes/rooms.routes.ts
// Routes Express pour les salles
// ============================================

import { Router } from "express";

// On importe le contrôleur
import { RoomController } from "../../../controllers/room.controller.js";

// Créer un routeur Express
const router = Router();

// ============================================
// Définition des routes
// ============================================

// GET /api/v1/rooms - Liste toutes les salles
router.get("/", (req, res) => RoomController.instance.getAll(req, res));

// GET /api/v1/rooms/availability - Disponibilité des salles
router.get("/availability", (req, res) => RoomController.instance.getRoomAvailability(req, res));

// Exporter le routeur
export { router as roomRoutes };
