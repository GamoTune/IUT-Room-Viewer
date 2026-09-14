// ============================================
// 📁 src/controllers/group.controller.ts
// Contrôleur pour les groupes
// ============================================

import type { Request, Response } from "express";
import { GroupService } from "../services/group.service.js";
import type { ApiResponse } from "../types/index.js";
import type { GroupResponse } from "../types/group.types.js";

/**
 * Contrôleur pour les endpoints des groupes
 */
export class GroupController {
    public static instance: GroupController = new GroupController();

    /**
     * GET /api/v1/groups
     * Liste les groupes, pour alimenter un sélecteur côté client
     */
    async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const groups = await GroupService.instance.getAllGroups();

            const response: ApiResponse<GroupResponse[]> = {
                success: true,
                data: groups,
            };
            res.json(response);
        } catch (error) {
            console.error("Erreur lors de la récupération des groupes:", error);
            res.status(500).json({
                success: false,
                error: "Erreur lors de la récupération des groupes",
            });
        }
    }
}
