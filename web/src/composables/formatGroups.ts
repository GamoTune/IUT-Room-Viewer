// ============================================
// 📁 src/composables/formatGroups.ts
// Libellés des groupes d'un cours
// ============================================

import type { GroupRef } from "../types/api";

/** Années, exposées en négatif par l'API : `-1` = A1. */
const YEARS: Record<number, string> = { [-1]: "A1", [-2]: "A2", [-3]: "A3" };

/**
 * Traduit les groupes d'un cours en libellés lisibles : `A1` pour une
 * promotion, `G1` pour un groupe entier, `G7A` pour un sous-groupe.
 *
 * L'API a déjà déterminé le niveau concerné ; il n'y a plus qu'à le nommer.
 */
export function formatGroups(groups: GroupRef[]): string {
    return groups
        .map(({ mainGroup, subGroup }) => {
            const main = YEARS[mainGroup] ?? `G${mainGroup}`;
            const sub = subGroup === 1 ? "A" : subGroup === 2 ? "B" : "";
            return main + sub;
        })
        .join(", ");
}
