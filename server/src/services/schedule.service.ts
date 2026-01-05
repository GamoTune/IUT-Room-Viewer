/**
 * Schedule Service
 * Logique métier pour l'emploi du temps
 */
import { getLessonsByGroup, parseGroupName, type ScheduleFilter } from "../repository/schedule.repository.js";
import type { Course, ScheduleQuery, ScheduleResponse } from "../types/schedule.types.js";

/**
 * Récupère l'emploi du temps d'un groupe pour une date
 */
export async function getScheduleForGroup(query: ScheduleQuery): Promise<ScheduleResponse> {
    const { group, year, tp, date } = query;

    // Calculer les dates de début et fin de la journée
    const targetDate = date ? new Date(date) : new Date();
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    // Convertir le nom du groupe en identifiants numériques
    const { mainGroup, subGroup } = parseGroupName(group, tp);

    // Récupérer les leçons
    const filter: ScheduleFilter = {
        mainGroup,
        subGroup,
        startDate,
        endDate,
    };

    const lessons = await getLessonsByGroup(filter);

    // Transformer en format Course
    const courses: Course[] = lessons.map((lesson) => {
        // Récupérer le titre depuis content.name
        const title = lesson.content?.name || "Cours";

        // Récupérer les salles
        const rooms = lesson.lesson_room
            ?.map((lr) => lr.room?.name)
            .filter((name): name is string => Boolean(name))
            .join(", ") || "N/A";

        // Récupérer le nom du professeur
        const teacherName = lesson.teacher?.name || undefined;

        return {
            id: lesson.id,
            title,
            startTime: lesson.start_datetime.toISOString(),
            endTime: lesson.end_datetime.toISOString(),
            room: rooms,
            teacher: teacherName,
            type: detectCourseType(title, lesson.type),
        };
    });

    return {
        group,
        year,
        tp,
        date: targetDate.toISOString().split("T")[0],
        courses,
    };
}

/**
 * Détecte le type de cours à partir du titre et du type de leçon
 */
function detectCourseType(title: string, lessonType?: string): Course["type"] {
    // Vérifier d'abord le type de la leçon si disponible
    if (lessonType) {
        const upperType = lessonType.toUpperCase();
        if (upperType === "CM") return "CM";
        if (upperType === "TD") return "TD";
        if (upperType === "TP") return "TP";
        if (upperType === "SAE") return "SAE";
        if (upperType === "DS" || upperType === "EXAM") return "DS";
    }

    // Sinon, analyser le titre
    const upperTitle = title.toUpperCase();

    if (upperTitle.includes("CM") || upperTitle.includes("AMPHI")) return "CM";
    if (upperTitle.includes("TP")) return "TP";
    if (upperTitle.includes("TD")) return "TD";
    if (upperTitle.includes("SAE")) return "SAE";
    if (upperTitle.includes("DS") || upperTitle.includes("EXAM")) return "DS";

    return "Autre";
}