// ============================================
// 📁 src/composables/groupMatch.ts
// Un cours concerne-t-il le groupe consulté ?
// ============================================

import type { Group, GroupRef } from "../types/api";

/** Années, exposées en négatif par l'API : `-1` = A1. */
const YEARS: Record<number, string> = { [-1]: "A1", [-2]: "A2", [-3]: "A3" };

/** Sous-groupes, exposés en nombre par l'API : `a` → 1, `b` → 2. */
function toSubGroupNumber(subGroup: string | null): number | null {
    if (subGroup === "a") return 1;
    if (subGroup === "b") return 2;
    return null;
}

/**
 * L'API a déjà réduit les groupes d'un cours à leur niveau réel : une promotion
 * entière, un groupe entier ou un sous-groupe. Il reste à savoir lequel de ces
 * trois niveaux englobe le groupe consulté.
 */
export function concernsGroup(refs: GroupRef[], group: Group | null): boolean {
    if (!group) return false;

    const mine = toSubGroupNumber(group.subGroup);

    return refs.some((ref) => {
        // Promotion entière : seule l'année compte.
        if (ref.mainGroup < 0) return YEARS[ref.mainGroup] === group.year;

        if (ref.mainGroup !== group.mainGroup) return false;

        // Groupe entier : les deux sous-groupes sont convoqués.
        if (ref.subGroup === -1) return true;

        return mine !== null && ref.subGroup === mine;
    });
}

/** Le groupe consulté, retrouvé dans la liste à partir de son code. */
export function findGroup(groups: Group[] | null, code: string | null): Group | null {
    if (!groups || !code) return null;
    return groups.find((group) => group.code === code) ?? null;
}
