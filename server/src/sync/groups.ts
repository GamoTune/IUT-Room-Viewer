// ============================================
// 📁 src/sync/groups.ts
// Décomposition des codes de groupes
// ============================================

/**
 * Décompose un code de groupe : `G1a` → groupe 1, sous-groupe `a`.
 * `G1` (sans lettre) désigne le groupe entier.
 */
export function parseGroupCode(code: string): { mainGroup: number; subGroup: string | null } | null {
    const matched = code.match(/^G(\d+)([a-z])?$/i);
    if (!matched) return null;

    return {
        mainGroup: Number(matched[1]),
        subGroup: matched[2]?.toLowerCase() ?? null,
    };
}

/**
 * Sous-groupes d'un groupe principal, dans l'ordre où ils apparaissent
 * verticalement dans les emplois du temps : `a` au-dessus de `b`.
 */
export function subGroupCodes(mainGroup: number): string[] {
    return [`G${mainGroup}a`, `G${mainGroup}b`];
}
