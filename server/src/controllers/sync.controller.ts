// ============================================
// 📁 src/sync/sync.controller.ts
// Contrôleur pour les opérations de synchronisation
// ============================================

import type { Request, Response } from "express";
import syncService from "../sync/sync.service.js";
import type { ApiResponse } from "../types/index.js";
import type { SyncStatus, SyncSummary } from "../sync/types.js";

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
            const status = syncService.getStatus();
            if (status.isRunning) {
                res.status(409).json({
                    success: false,
                    error: "Une synchronisation est déjà en cours",
                });
                return;
            }

            // Lancer la synchronisation
            const result = await syncService.syncAll({ archiveOthers: true });

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
     * POST /api/v1/sync/reset
     * Réinitialise la synchronisation (supprime tous les EDT pour forcer une re-sync)
     */
    async resetSync(_req: Request, res: Response): Promise<void> {
        try {
            // Reprise complète : les en-têtes de cache sont ignorés
            const result = await syncService.syncAll({ force: true, archiveOthers: true });
            res.json({
                success: result.success,
                data: result,
            });
        } catch (error) {
            console.error("Erreur lors du reset de la sync:", error);
            res.status(500).json({
                success: false,
                error: "Erreur lors du reset de la synchronisation",
            });
        }
    }

    /**
     * GET /api/v1/sync/status
     * Retourne le statut de la synchronisation
     */
    async getStatus(_req: Request, res: Response): Promise<void> {
        try {
            const status = syncService.getStatus();

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
