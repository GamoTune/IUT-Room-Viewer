// ============================================
// 📁 src/api/controllers/room.controller.ts
// Contrôleur pour les salles (handlers Express)
// ============================================

import type { Request, Response } from "express";

// On importe le service (logique métier)
import { RoomService } from "../services/room.service.js";

// On importe les types
import type { ApiResponse, Room, RoomWithLessonsResponse } from "../types/index.js";

/**
 * Contrôleur pour les opérations sur les salles
 * 
 * Un contrôleur contient les handlers Express.
 * Il gère la requête HTTP et délègue la logique au service.
 */
export class RoomController {
    public static instance: RoomController = new RoomController();

    /**
     * GET /api/v1/rooms
     * Récupère toutes les salles
     */
    async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const rooms = await RoomService.instance.getAllRooms();

            const response: ApiResponse<Room[]> = {
                success: true,
                data: rooms ?? [],
            };
            res.json(response);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: "Erreur lors de la récupération des salles : " + error,
            });
        }
    }

    /**
     * GET /api/v1/rooms/availability?startTime=...&endTime=...
     * Récupère la disponibilité des salles
     */
    async getRoomAvailability(req: Request, res: Response): Promise<void> {
        try {
            // Récupérer les paramètres de la requête
            const { startTime, endTime } = req.query;

            // Validation basique
            if (!startTime || !endTime) {
                res.status(400).json({
                    success: false,
                    error: "Les paramètres startTime et endTime sont requis",
                });
                return;
            }

            // Convertir en Date
            const start = new Date(startTime as string);
            const end = new Date(endTime as string);

            // Appeler le service
            const availability = await RoomService.instance.getRoomsAvailability(start, end);

            const response: ApiResponse<RoomWithLessonsResponse[]> = {
                success: true,
                data: availability,
            };
            res.json(response);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: "Erreur lors de la récupération de la disponibilité",
            });
        }
    }

    /**
     * GET /api/v1/rooms/:name/schedule?startTime=...&endTime=...
     * Récupère l'emploi du temps d'une salle
    
    async getSchedule(req: Request, res: Response): Promise<void> {
        try {
            const { name } = req.params;
            const { startTime, endTime } = req.query;

            if (!startTime || !endTime) {
                res.status(400).json({
                    success: false,
                    error: "Les paramètres startTime et endTime sont requis",
                });
                return;
            }

            const start = new Date(startTime as string);
            const end = new Date(endTime as string);

            const schedule = await RoomService.instance.getRoomSchedule(name, start, end);

            const response: ApiResponse<LessonResponse[]> = {
                success: true,
                data: schedule,
            };
            res.json(response);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: "Erreur lors de la récupération de l'emploi du temps",
            });
        }
    } */
}