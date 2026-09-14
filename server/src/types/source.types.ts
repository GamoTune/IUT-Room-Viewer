// ============================================
// 📁 src/types/source.types.ts
// Documents publiés par l'IUT pour une semaine
// ============================================

import type { SourceFormat } from "../entities/enums.js";

/** Niveau d'un document, du plus précis au plus large. */
export type SourceLevel = "subGroup" | "group" | "year";

/** Un emplacement de document : publié ou non par l'IUT. */
export interface SourceFileResponse {
    level: SourceLevel;
    /** Périmètre publié : `G8a`, `G8`, `A3`. `null` quand le niveau n'existe pas pour ce groupe. */
    scope: string | null;
    format: SourceFormat;
    /** Adresse du document chez l'IUT, `null` quand il n'est pas publié. */
    url: string | null;
}

export interface WeekSourcesResponse {
    /** Semaine depuis la rentrée (`S2`), `null` quand aucun document ne couvre la période. */
    weekNumber: number | null;
    /**
     * Toujours six emplacements, du sous-groupe à l'année, PDF puis ICS : un
     * document absent reste une ligne, pour que son absence se voie.
     */
    files: SourceFileResponse[];
}
