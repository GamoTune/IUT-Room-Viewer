// ============================================
// 📁 src/controllers/source.controller.ts
// Contrôleur des documents publiés
// ============================================

import type { Request, Response } from "express";
import { SourceService } from "../services/source.service.js";
import { parseGroupCode } from "../sync/groups.js";
import type { ApiResponse } from "../types/index.js";
import type { WeekSourcesResponse } from "../types/source.types.js";

export class SourceController {
    public static instance: SourceController = new SourceController();

    /**
     * GET /api/v1/sources?group=G8a&start_at=…
     * Les documents de l'IUT pour un groupe, sur la semaine qui commence à `start_at`
     */
    async getWeek(req: Request, res: Response): Promise<void> {
        const { group, start_at } = req.query;

        if (typeof group !== "string" || parseGroupCode(group) === null) {
            res.status(400).json({ success: false, error: "Le paramètre group doit être un code de groupe (G8a)" });
            return;
        }

        const from = typeof start_at === "string" ? new Date(start_at) : null;
        if (!from || Number.isNaN(from.getTime())) {
            res.status(400).json({ success: false, error: "Le paramètre start_at doit être une date ISO 8601" });
            return;
        }

        try {
            const sources = await SourceService.instance.getWeekSources(group, from);

            if (!sources) {
                res.status(404).json({ success: false, error: `Groupe inconnu : ${group}` });
                return;
            }

            const response: ApiResponse<WeekSourcesResponse> = { success: true, data: sources };
            res.json(response);
        } catch (error) {
            console.error("Erreur lors de la récupération des documents:", error);
            res.status(500).json({ success: false, error: "Erreur lors de la récupération des documents" });
        }
    }
}
