/**
 * Schedule Controller
 * Gère les requêtes HTTP pour l'emploi du temps
 */
import type { Request, Response } from 'express';
import { getScheduleForGroup } from '../services/schedule.service.js';
/**
 * GET /api/v1/schedule
 * Récupère l'emploi du temps d'un groupe
 */
export async function getSchedule(req: Request, res: Response) {
    try {
        const { group, tp, date } = req.query;

        // Validation
        if (!group || typeof group !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Le paramètre "group" est requis',
            });
        }

        // Récupérer l'emploi du temps
        const schedule = await getScheduleForGroup({
            group,
            tp: typeof tp === 'string' ? tp : undefined,
            date: typeof date === 'string' ? date : undefined,
        });

        res.json({
            success: true,
            data: schedule,
        });

    } catch (error) {
        console.error('Schedule error:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération de l\'emploi du temps',
        });
    }
}