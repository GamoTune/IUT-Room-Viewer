// ============================================
// 📁 src/types/group.types.ts
// Types des réponses liées aux groupes
// ============================================

/** Un groupe d'étudiants, tel qu'exposé par l'API. */
export interface GroupResponse {
    /** Code publié par l'IUT, utilisable comme filtre : `G8a`. */
    code: string;
    /** Libellé d'affichage : `G8A`. */
    label: string;
    year: string;
    mainGroup: number;
    /** `a`, `b`, ou `null` pour un groupe sans sous-groupe. */
    subGroup: string | null;
}
