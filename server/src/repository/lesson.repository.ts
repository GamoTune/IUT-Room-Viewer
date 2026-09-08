// ============================================
// 📁 src/repository/lesson.repository.ts
// Accès aux cours, partagé par les services de lecture
// ============================================

import { and, asc, eq, gt, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { lesson, lessonGroup, lessonRoom, room, studentGroup, teacher } from "../db/schema.js";
import type { LessonWithRelations } from "../types/lesson.types.js";

/**
 * Manière de confronter un cours à la fenêtre demandée.
 *
 * - `overlap`   : le cours croise la fenêtre (occupation d'une salle à un instant)
 * - `start`     : le cours commence dans la fenêtre (emploi du temps d'une journée)
 * - `contained` : le cours tient entièrement dans la fenêtre (export de cours)
 */
export type WindowMode = "overlap" | "start" | "contained";

export interface LessonFilter {
    from: Date;
    to: Date;
    mode: WindowMode;
    /** Codes de groupes tels que publiés (`G1a`, `G4b`...). */
    groupCodes?: string[];
    roomNames?: string[];
    /** Formes d'enseignant à retenir : noms, codes, ou les deux. */
    teacherNames?: string[];
}

function windowCondition(filter: LessonFilter) {
    switch (filter.mode) {
        case "start":
            return and(gte(lesson.startUtc, filter.from), lt(lesson.startUtc, filter.to));
        case "contained":
            return and(gte(lesson.startUtc, filter.from), lte(lesson.endUtc, filter.to));
        default:
            // `/salles_maintenant` interroge un instant (from === to) : un cours
            // qui commence pile à cet instant occupe déjà la salle, d'où le `<=`.
            // Sur une vraie fenêtre, un cours démarrant à `to` reste exclu.
            return filter.from >= filter.to
                ? and(lte(lesson.startUtc, filter.from), gt(lesson.endUtc, filter.from))
                : and(lt(lesson.startUtc, filter.to), gt(lesson.endUtc, filter.from));
    }
}

/**
 * Identifie les cours retenus par le filtre.
 * Les jointures ne sont ajoutées que si un critère les concerne, pour éviter
 * de multiplier les lignes inutilement.
 */
async function findLessonIds(filter: LessonFilter): Promise<number[]> {
    const conditions = [windowCondition(filter)];

    if (filter.groupCodes?.length) {
        conditions.push(
            sql`EXISTS (
                SELECT 1 FROM ${lessonGroup}
                JOIN ${studentGroup} ON ${studentGroup.id} = ${lessonGroup.groupId}
                WHERE ${lessonGroup.lessonId} = ${lesson.id}
                  AND ${studentGroup.code} IN ${filter.groupCodes}
            )`,
        );
    }

    if (filter.roomNames?.length) {
        conditions.push(
            sql`EXISTS (
                SELECT 1 FROM ${lessonRoom}
                JOIN ${room} ON ${room.id} = ${lessonRoom.roomId}
                WHERE ${lessonRoom.lessonId} = ${lesson.id}
                  AND ${room.name} IN ${filter.roomNames}
            )`,
        );
    }

    if (filter.teacherNames?.length) {
        conditions.push(
            sql`EXISTS (
                SELECT 1 FROM ${teacher}
                WHERE ${teacher.id} = ${lesson.teacherId}
                  AND ${teacher.name} IN ${filter.teacherNames}
            )`,
        );
    }

    const rows = await db
        .select({ id: lesson.id })
        .from(lesson)
        .where(and(...conditions))
        .orderBy(asc(lesson.startUtc));

    return rows.map((row) => row.id);
}

/**
 * Récupère les cours du filtre, avec matière, enseignant, salles et groupes.
 */
export async function findLessons(filter: LessonFilter): Promise<LessonWithRelations[]> {
    const ids = await findLessonIds(filter);
    if (ids.length === 0) return [];

    return db.query.lesson.findMany({
        where: inArray(lesson.id, ids),
        orderBy: asc(lesson.startUtc),
        with: {
            subject: true,
            teacher: true,
            rooms: { with: { room: true } },
            groups: { with: { group: true } },
        },
    });
}

/**
 * Toutes les salles du référentiel, dans l'ordre d'affichage.
 */
export async function findAllRooms() {
    return db.select().from(room).orderBy(asc(room.displayOrder));
}

/**
 * Effectifs des groupes, pour reconnaître un cours suivi par une promo entière
 * ou par un groupe entier plutôt que par un seul sous-groupe.
 */
export interface GroupCensus {
    /** Nombre de sous-groupes par année : `A1` → 6 */
    perYear: Map<string, number>;
    /** Nombre de sous-groupes par groupe principal : `1` → 2 (G1a, G1b) */
    perMainGroup: Map<number, number>;
}

export async function loadGroupCensus(): Promise<GroupCensus> {
    const rows = await db
        .select({
            year: studentGroup.year,
            mainGroup: studentGroup.mainGroup,
            total: sql<number>`count(*)::int`,
        })
        .from(studentGroup)
        .groupBy(studentGroup.year, studentGroup.mainGroup);

    const perYear = new Map<string, number>();
    const perMainGroup = new Map<number, number>();

    for (const row of rows) {
        perYear.set(row.year, (perYear.get(row.year) ?? 0) + row.total);
        perMainGroup.set(row.mainGroup, row.total);
    }

    return { perYear, perMainGroup };
}

/**
 * Toutes les formes d'enseignant rencontrées dans les documents.
 */
export async function findAllTeachers() {
    return db.select().from(teacher).orderBy(asc(teacher.name));
}

/**
 * Un cours par identifiant de salle, utilisé pour l'occupation instantanée.
 */
export async function findRoomByName(name: string) {
    const [found] = await db.select().from(room).where(eq(room.name, name)).limit(1);
    return found ?? null;
}
