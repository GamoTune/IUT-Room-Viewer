// ============================================
// 📁 src/services/course.service.ts
// Logique métier pour les cours
// ============================================

import lessonRepository from "../repository/lesson.repository.js";
import { groupsOf, toGroupLabels } from "./lesson.mapper.js";
import type { Course } from "../types/course.types.js";

export interface GET_COURSES_SERVICE_PARAMS {
    start_at: string; // ISO date string
    end_at: string;   // ISO date string
    groups?: string;  // codes de groupes séparés par des virgules
    rooms?: string;   // noms de salles séparés par des virgules
    teachers?: string; // formes d'enseignant séparées par des virgules
}

/**
 * Service pour la logique métier des cours
 */
export class CourseService {
    public static instance: CourseService = new CourseService();

    /**
     * Normalise une chaîne : minuscules + suppression des accents
     */
    private normalize(value: string): string {
        return value
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "");
    }

    /**
     * Résout ce que l'utilisateur a saisi vers les formes présentes en base.
     *
     * Un enseignant est désigné tantôt par un nom (`Onete C.`), tantôt par un
     * code (`CO`), sans lien entre les deux : la commande du bot envoie les deux
     * et on réunit ce qui correspond. La correspondance exacte prime ; à défaut,
     * on accepte une correspondance partielle sur le nom.
     */
    private async resolveTeacherNames(inputs: string[]): Promise<string[]> {
        const known = await lessonRepository.findAllTeachers();
        const resolved: string[] = [];

        for (const input of inputs) {
            const trimmed = input.trim();
            if (trimmed.length === 0) continue;

            const exact = known.find((candidate) => candidate.name.toUpperCase() === trimmed.toUpperCase());
            if (exact) {
                resolved.push(exact.name);
                continue;
            }

            const normalized = this.normalize(trimmed);
            const partial = known.find((candidate) => this.normalize(candidate.name).includes(normalized));
            if (partial) resolved.push(partial.name);
            // Sans correspondance, la saisie est simplement ignorée
        }

        return resolved;
    }

    async getCourses(params: GET_COURSES_SERVICE_PARAMS): Promise<Course[]> {
        // Résoudre les enseignants avant la requête
        let resolvedTeachers: string[] | undefined;
        if (params.teachers) {
            resolvedTeachers = await this.resolveTeacherNames(params.teachers.split(","));
            // Aucun enseignant reconnu : il n'y a rien à renvoyer
            if (resolvedTeachers.length === 0) return [];
        }

        const [lessons, census] = await Promise.all([
            lessonRepository.findMany({
                from: params.start_at ? new Date(params.start_at) : new Date(),
                to: params.end_at ? new Date(params.end_at) : new Date(),
                mode: "contained",
                groupCodes: params.groups ? params.groups.split(",").map((code) => code.trim()) : undefined,
                roomNames: params.rooms ? params.rooms.split(",").map((name) => name.trim()) : undefined,
                teacherNames: resolvedTeachers,
            }),
            lessonRepository.loadGroupCensus(),
        ]);

        return lessons.map((lesson) => ({
            code: lesson.subject.code,
            title: lesson.subject.label,
            type: lesson.type,
            rooms: (lesson.rooms ?? []).map((room) => room.name),
            groups: toGroupLabels(groupsOf(lesson), census),
            teacher: lesson.teacher?.name ?? "Inconnu",
            start_at: lesson.startUtc.toISOString(),
            end_at: lesson.endUtc.toISOString(),
        }));
    }
}
