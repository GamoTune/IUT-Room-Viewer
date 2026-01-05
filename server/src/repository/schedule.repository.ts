/**
 * Schedule Repository
 * Accède aux données de cours dans la base de données
 */
import prisma from "../lib/prismaEDT.js";

export interface ScheduleFilter {
    mainGroup: number;  // Groupe principal (1-8)
    subGroup?: number;  // Sous-groupe (0=tous, 1=A, 2=B)
    startDate: Date;
    endDate: Date;
}

/**
 * Récupère les leçons pour un groupe sur une période
 */
export async function getLessonsByGroup(filter: ScheduleFilter) {
    const { mainGroup, subGroup, startDate, endDate } = filter;

    // Construire la condition pour les groupes
    const groupConditions = buildGroupConditions(mainGroup, subGroup);

    const lessons = await prisma.lesson.findMany({
        where: {
            start_datetime: {
                gte: startDate,
                lt: endDate,
            },
            // Filtrer par groupe via la table de liaison lesson_group
            lesson_group: {
                some: {
                    group: groupConditions,
                },
            },
        },
        include: {
            content: true,
            teacher: true,
            lesson_room: {
                include: {
                    room: true,
                },
            },
            lesson_group: {
                include: {
                    group: true,
                },
            },
        },
        orderBy: {
            start_datetime: "asc",
        },
    });

    return lessons;
}

/**
 * Construit les conditions de filtre pour les groupes
 * - mainGroup: le groupe principal (1-8)
 * - subGroup: 0 = tous, 1 = A, 2 = B
 */
function buildGroupConditions(mainGroup: number, subGroup?: number) {
    if (subGroup !== undefined && subGroup > 0) {
        // Filtre exact sur main_group ET sub_group
        return {
            main_group: mainGroup,
            sub_group: subGroup,
        };
    }

    // Filtre sur main_group uniquement (tous les sous-groupes)
    return {
        main_group: mainGroup,
    };
}

/**
 * Convertit un nom de groupe en identifiants numériques
 * Ex: "G3" -> mainGroup: 3
 *     "A" ou "B" -> subGroup: 1 ou 2
 */
export function parseGroupName(group: string, tp?: string): { mainGroup: number; subGroup?: number } {
    // Extraire le numéro du groupe (G1, G2, A1, A2, etc.)
    const groupMatch = group.match(/[GAga]?(\d+)/i);
    const mainGroup = groupMatch ? parseInt(groupMatch[1], 10) : 1;

    // Convertir le sous-groupe (A=1, B=2)
    let subGroup: number | undefined;
    if (tp) {
        const tpUpper = tp.toUpperCase();
        if (tpUpper === "A") subGroup = 1;
        else if (tpUpper === "B") subGroup = 2;
    }

    return { mainGroup, subGroup };
}