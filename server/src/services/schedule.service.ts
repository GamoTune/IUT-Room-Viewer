/**
 * Schedule Service
 * Logique métier pour l'emploi du temps
 */
import lessonRepository from "../repository/lesson.repository.js";
import type { Course, ScheduleQuery, ScheduleResponse } from "../types/schedule.types.js";

/**
 * Déduit l'année de BUT à partir du numéro de groupe
 * G1, G2, G3 -> BUT1
 * G4, G5 -> BUT2
 * G7, G8 -> BUT3
 */
function getYearFromGroup(mainGroup: number): string {
    if (mainGroup >= 1 && mainGroup <= 3) return "BUT1";
    if (mainGroup >= 4 && mainGroup <= 5) return "BUT2";
    if (mainGroup >= 7 && mainGroup <= 8) return "BUT3";
    return "BUT1"; // Par défaut
}

/**
 * Extrait le numéro de groupe principal d'un libellé (`G3` → 3).
 */
export function parseGroupName(group: string): number {
    const matched = group.match(/[GAga]?(\d+)/);
    return matched?.[1] ? Number.parseInt(matched[1], 10) : 1;
}

/**
 * Codes de groupes à interroger pour une demande.
 *
 * Les emplois du temps n'existent que par sous-groupe : sans précision de TP,
 * on interroge les deux (`G3a` et `G3b`), ce qui restitue bien les cours
 * communs, chaque cours n'étant stocké qu'une fois.
 */
function resolveGroupCodes(mainGroup: number, tp?: string): string[] {
    const suffix = tp?.trim().toLowerCase();

    if (suffix === "a" || suffix === "b") {
        return [`G${mainGroup}${suffix}`];
    }

    return [`G${mainGroup}a`, `G${mainGroup}b`];
}

/**
 * Récupère l'emploi du temps d'un groupe pour une date
 */
export async function getScheduleForGroup(query: ScheduleQuery): Promise<ScheduleResponse> {
    const { group, tp, date } = query;

    // Calculer les dates de début et fin de la journée
    const targetDate = date ? new Date(date) : new Date();
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const mainGroup = parseGroupName(group);
    const year = getYearFromGroup(mainGroup);

    const lessons = await lessonRepository.findMany({
        from: startDate,
        to: endDate,
        mode: "start",
        groupCodes: resolveGroupCodes(mainGroup, tp),
    });

    // Transformer en format Course
    const courses: Course[] = lessons.map((lesson) => {
        const code = lesson.subject.code;
        const title = lesson.subject.label;

        const rooms = (lesson.rooms ?? []).map((room) => room.name).join(", ") || "N/A";
        const teacherName = lesson.teacher?.name ?? undefined;

        return {
            id: lesson.id,
            code,
            title,
            startTime: lesson.startUtc.toISOString(),
            endTime: lesson.endUtc.toISOString(),
            room: rooms,
            teacher: teacherName,
            type: detectCourseType(title, lesson.type, code),
        };
    });

    return {
        group,
        year,
        tp,
        date: targetDate.toISOString().split("T")[0]!,
        courses,
    };
}

/**
 * Détecte le type de cours à partir du code, du type de leçon et du titre
 */
function detectCourseType(title: string, lessonType?: string, code?: string): Course["type"] {
    // Une SAÉ se reconnaît à son code (`S3.01`, `S5A.01`), pas à son type :
    // les documents la publient comme un TD ou un cours ordinaire.
    if (code && /^S\d/i.test(code)) return "SAE";

    // Vérifier ensuite le type de la leçon si disponible
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
