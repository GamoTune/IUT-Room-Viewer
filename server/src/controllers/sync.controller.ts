// ============================================
// 📁 src/sync/sync.controller.ts
// Contrôleur pour les opérations de synchronisation
// ============================================

import type { Request, Response } from "express";
import { SyncService } from "../services/sync.service.js";
import type { ApiResponse } from "../types/index.js";
import type { SyncSummary, SyncStatus } from "../types/sync.types.js";

/**
 * Contrôleur pour les endpoints de synchronisation
 */
export class SyncController {
    public static instance: SyncController = new SyncController();

    /**
     * POST /api/v1/sync/trigger
     * Déclenche une synchronisation manuelle
     */
    async triggerSync(_req: Request, res: Response): Promise<void> {
        try {
            // Vérifier si une sync est déjà en cours
            const status = SyncService.instance.getStatus();
            if (status.isRunning) {
                res.status(409).json({
                    success: false,
                    error: "Une synchronisation est déjà en cours",
                });
                return;
            }

            // Lancer la synchronisation
            const result = await SyncService.instance.syncAll();

            const response: ApiResponse<SyncSummary> = {
                success: result.success,
                data: result,
            };
            res.json(response);
        } catch (error) {
            console.error("Erreur lors du déclenchement de la sync:", error);
            res.status(500).json({
                success: false,
                error: "Erreur lors de la synchronisation",
            });
        }
    }

    /**
     * GET /api/v1/sync/status
     * Retourne le statut de la synchronisation
     */
    async getStatus(_req: Request, res: Response): Promise<void> {
        try {
            const status = SyncService.instance.getStatus();

            const response: ApiResponse<SyncStatus> = {
                success: true,
                data: status,
            };
            res.json(response);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: "Erreur lors de la récupération du statut",
            });
        }
    }
}
