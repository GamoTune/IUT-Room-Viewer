// ============================================
// 📁 src/services/lesson.mapper.ts
// Traduction des cours vers le format attendu par l'API
// ============================================

import type { GroupCensus } from "../repository/lesson.repository.js";
import type { Lesson } from "../entities/lesson.entity.js";
import type { StudentGroup } from "../entities/studentGroup.entity.js";
import type { GroupRef, LessonResponse } from "../types/lesson.types.js";

/**
 * Identifiants d'année attendus par le bot : `A1` → -1, `A2` → -2, `A3` → -3
 * (voir `MAIN_GROUP_CODES` dans bot/src/utils/format.ts).
 */
const YEAR_TO_MAIN_GROUP: Record<string, number> = { A1: -1, A2: -2, A3: -3 };

/** Réciproque, pour les libellés : -1 → `A1`. */
const MAIN_GROUP_TO_YEAR: Record<number, string> = { [-1]: "A1", [-2]: "A2", [-3]: "A3" };

/** Sous-groupes : `a` → 1, `b` → 2, groupe entier → -1. */
function subGroupToNumber(subGroup: string | null): number {
    if (subGroup === "a") return 1;
    if (subGroup === "b") return 2;
    return -1;
}

/**
 * Traduit les groupes d'un cours vers la forme `{ mainGroup, subGroup }`.
 *
 * Les emplois du temps étant publiés par sous-groupe, un cours suivi
 * collectivement apparaît rattaché à plusieurs d'entre eux. On restitue donc le
 * niveau réel : tous les sous-groupes d'une année → cours de promotion
 * (`mainGroup` négatif) ; tous les sous-groupes d'un groupe → groupe entier
 * (`subGroup: -1`). Sans quoi un amphi de A1 s'afficherait `G1A`, et un TD de
 * G1 s'afficherait `G1A` au lieu de `G1`.
 */
export function toGroupRefs(groups: StudentGroup[], census: GroupCensus): GroupRef[] {
    if (groups.length === 0) return [];

    const years = new Set(groups.map((group) => group.year));

    if (years.size === 1) {
        const year = [...years][0]!;
        const expected = census.perYear.get(year);

        if (expected !== undefined && groups.length >= expected) {
            return [{ mainGroup: YEAR_TO_MAIN_GROUP[year] ?? -1, subGroup: -1 }];
        }
    }

    // Regrouper par groupe principal pour détecter les groupes complets
    const byMainGroup = new Map<number, StudentGroup[]>();
    for (const group of groups) {
        const existing = byMainGroup.get(group.mainGroup);
        if (existing) existing.push(group);
        else byMainGroup.set(group.mainGroup, [group]);
    }

    const refs: GroupRef[] = [];

    for (const [mainGroup, members] of byMainGroup) {
        const expected = census.perMainGroup.get(mainGroup);

        if (expected !== undefined && members.length >= expected) {
            refs.push({ mainGroup, subGroup: -1 });
            continue;
        }

        for (const member of members) {
            refs.push({ mainGroup, subGroup: subGroupToNumber(member.subGroup) });
        }
    }

    return refs.sort((a, b) => a.mainGroup - b.mainGroup || a.subGroup - b.subGroup);
}

/**
 * Libellés lisibles des groupes d'un cours : `A1` pour une promotion entière,
 * `G1` pour un groupe entier, `G7A` pour un sous-groupe.
 */
export function toGroupLabels(groups: StudentGroup[], census: GroupCensus): string[] {
    return toGroupRefs(groups, census).map(({ mainGroup, subGroup }) => {
        const main = MAIN_GROUP_TO_YEAR[mainGroup] ?? `G${mainGroup}`;
        const sub = subGroup === 1 ? "A" : subGroup === 2 ? "B" : "";
        return main + sub;
    });
}

/** Groupes rattachés à un cours, extraits de ses liaisons. */
export function groupsOf(lesson: Lesson): StudentGroup[] {
    return (lesson.groups ?? []).map((link) => link.group).filter((group): group is StudentGroup => Boolean(group));
}

/**
 * Traduit un cours complet en réponse API.
 */
export function toLessonResponse(lesson: Lesson, census: GroupCensus): LessonResponse {
    return {
        id: lesson.id,
        type: lesson.type,
        startTime: lesson.startUtc.toISOString(),
        endTime: lesson.endUtc.toISOString(),
        rooms: (lesson.rooms ?? []).map((room) => room.name),
        teacher: lesson.teacher?.name ?? null,
        contentCode: lesson.subject.code,
        contentName: lesson.subject.label,
        groups: toGroupRefs(groupsOf(lesson), census),
    };
}
