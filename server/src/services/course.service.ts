// ============================================
// 📁 src/services/courses.service.ts
// Logique métier pour les salles
// ============================================

import { CourseRepository } from "../repository/course.repository.js";
import { Course, CourseResult } from "../types/course.types.js";

// On importe le repository (accès BDD)


// On importe les types


export interface GET_COURSES_SERVICE_PARAMS {
    start_at: string; // ISO date string
    end_at: string;   // ISO date string
    groups?: string; // optional array of group codes
    rooms?: string;    // optional array of room codes
    teachers?: string; // optional array of teacher codes
}

export interface GET_COURSES_REPOSITORY_PARAMS {
    start_at: Date;
    end_at: Date;
    groups?: string[];
    rooms?: string[];
    teachers?: string[];
}





/**
 * Service pour la logique métier des cours
 * 
 * Un service contient la LOGIQUE MÉTIER.
 * Il utilise les repositories pour accéder aux données.
 */
export class CourseService {
    public static instance: CourseService = new CourseService();

    /**
     * Normalise une chaîne : minuscules + suppression des accents
     */
    private normalize(str: string): string {
        return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    /**
     * Résout les noms de profs entrés par l'utilisateur vers les noms exacts en base
     * Le champ name peut contenir soit un nom complet (ex: "Hugel T.") soit un alias (ex: "TH")
     * - Si l'entrée fait < 5 caractères → c'est un alias → match exact (case-insensitive)
     * - Sinon → normalisation et recherche partielle dans les noms complets
     */
    private async resolveTeacherNames(inputTeachers: string[]): Promise<string[]> {
        const allTeachers = await CourseRepository.instance.findAllTeachers();
        const resolvedNames: string[] = [];

        for (const input of inputTeachers) {
            const trimmedInput = input.trim();
            
            // Si < 5 caractères, c'est un alias → on cherche un match exact (case-insensitive)
            if (trimmedInput.length < 5) {
                const matchedByAlias = allTeachers.find(
                    t => t.name?.toUpperCase() === trimmedInput.toUpperCase()
                );
                if (matchedByAlias?.name) {
                    resolvedNames.push(matchedByAlias.name);
                }
                // Si pas trouvé, on ignore
                continue;
            }

            // Sinon, on normalise et on cherche dans les noms complets (>= 5 caractères)
            const normalizedInput = this.normalize(trimmedInput);
            
            const matched = allTeachers.find(t => {
                if (!t.name || t.name.length < 5) return false; // Ignorer les alias
                const normalizedName = this.normalize(t.name);
                // Vérifie si le nom normalisé contient l'input normalisé
                return normalizedName.includes(normalizedInput) || normalizedInput.includes(normalizedName.split(" ")[0]);
            });

            if (matched?.name) {
                resolvedNames.push(matched.name);
            }
            // Si pas de match, on n'ajoute rien (le prof n'existe pas en base)
        }

        return resolvedNames;
    }

    async getCourses(_params: GET_COURSES_SERVICE_PARAMS): Promise<Course[]> {
        // Résoudre les noms de profs avant de faire la requête
        let resolvedTeachers: string[] | undefined;
        if (_params.teachers) {
            const inputTeachers = _params.teachers.split(",");
            resolvedTeachers = await this.resolveTeacherNames(inputTeachers);
            // Si aucun prof n'a été résolu, on retourne un tableau vide (pas de résultats)
            if (resolvedTeachers.length === 0) {
                return [];
            }
        }

        const params: GET_COURSES_REPOSITORY_PARAMS = {
            start_at: _params.start_at ? new Date(_params.start_at) : new Date(),
            end_at: _params.end_at ? new Date(_params.end_at) : new Date(),
            groups: _params.groups ? (_params.groups.split(",")) : undefined,
            rooms: _params.rooms ? (_params.rooms.split(",")) : undefined,
            teachers: resolvedTeachers,
        };

        const courseResults: CourseResult[] = await CourseRepository.instance.findMany(params);

        return courseResults.map((course) => ({
            code: course.content.code,
            title: course.content.name,
            type: course.type,
            rooms: course.lesson_room.map(lr => lr.room.name),
            groups: course.lesson_group.map(lg => lg.group.name ?? ""),
            teacher: course.teacher ? (course.teacher.name ?? "Inconnu") : "Inconnu",
            start_at: course.start_datetime.toISOString(),
            end_at: course.end_datetime.toISOString(),
        }));
    }
}

