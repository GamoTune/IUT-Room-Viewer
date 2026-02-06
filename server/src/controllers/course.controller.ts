// ============================================
// 📁 src/controllers/course.controller.ts
// Contrôleur pour les cours (handlers Express)
// ============================================

import type { Request, Response } from "express";

import { CourseService } from "../services/course.service.js";



// On importe les types
import { ApiResponse, Course } from "../types/index.js";
import { GET_COURSES_SERVICE_PARAMS } from "../services/course.service.js";

/**
 * Contrôleur pour les opérations sur les cours
 * 
 * Un contrôleur contient les handlers Express.
 * Il gère la requête HTTP et délègue la logique au service.
 */
export class CourseController {
    public static instance: CourseController = new CourseController();


    /**
     * GET /api/v1/courses
     * Récupère les cours voulus
    */
    async getCourses(_req: Request, res: Response): Promise<void> {
        try {
            const { start_at, end_at, groups, rooms, teachers } = _req.query;

            if (!start_at || !end_at) {
                res.status(400).json({
                    success: false,
                    error: "Les paramètres start_at et end_at sont requis",
                });
                return;
            }


            const params: GET_COURSES_SERVICE_PARAMS = {
                start_at: start_at as string,
                end_at: end_at as string,
                groups: groups as string | undefined,
                rooms: rooms as string | undefined,
                teachers: teachers as string | undefined,

            };

            // Appel au service pour récupérer les cours
            const courses: Course[] = await CourseService.instance.getCourses(params);

            const response: ApiResponse<Course[]> = {
                success: true,
                data: courses ?? [],
            };
            res.json(response);
    
        } catch (error) {
            res.status(500).json({
                success: false,
                error: "Erreur lors de la récupération des cours : " + error,
            });
        }
    }

};
