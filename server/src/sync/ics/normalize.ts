// ============================================
// 📁 src/sync/ics/normalize.ts
// Interprétation du contenu textuel des événements ICS
// ============================================

import type { LessonType } from "../../entities/enums.js";
import type { RawIcsEvent } from "./parser.js";

import { NO_ROOM } from "../rooms.js";

/**
 * Correspondance des libellés de type publiés vers nos types internes.
 * Tout le reste tombe dans `OTHER` : l'IUT ajoute des libellés en cours d'année.
 */
const TYPE_MAP: Record<string, LessonType> = {
    cours: "CM",
    cm: "CM",
    td: "TD",
    tp: "TP",
};

export interface SummaryParts {
    subjectCode: string;
    subjectLabel: string;
    teacherInitials: string | null;
    type: LessonType;
    /** `true` quand le SUMMARY ne suit pas la forme attendue. */
    degraded: boolean;
}

/**
 * Décompose un SUMMARY de la forme `<code> <code> <intitulé> <prof> <type>`.
 *
 * Exemples réels :
 *   `R1.10 R1.10 R1.10 - Anglais technique JP TD`
 *   `S3.01A S3.01A S3.01 - Developpement logiciel LD Cours`  (code ≠ code de l'intitulé)
 *   `SCO SCO ACCUEIL/Rentree . Cours`                        (pas de tiret, pas de prof)
 *   `FERIE FERIE FERIE . Cours`
 *
 * Un SUMMARY non reconnu n'est jamais jeté : il est conservé en mode dégradé
 * pour que l'occupation de la salle reste comptabilisée.
 */
export function parseSummary(summary: string): SummaryParts {
    const cleaned = summary.replace(/\s+/g, " ").trim();
    const tokens = cleaned.split(" ").filter((token) => token.length > 0);

    if (tokens.length < 3) {
        return {
            subjectCode: tokens[0] ?? "INCONNU",
            subjectLabel: cleaned || "INCONNU",
            teacherInitials: null,
            type: "OTHER",
            degraded: true,
        };
    }

    const typeToken = tokens[tokens.length - 1]!;
    const teacherToken = tokens[tokens.length - 2]!;
    const subjectCode = tokens[0]!;

    const type = TYPE_MAP[typeToken.toLowerCase()] ?? "OTHER";
    const teacherInitials = teacherToken === NO_ROOM ? null : teacherToken;

    // Tout ce qui reste entre le premier code et le couple (prof, type)
    const middle = tokens.slice(1, tokens.length - 2);
    const subjectLabel = extractLabel(middle, subjectCode);

    return {
        subjectCode,
        subjectLabel,
        teacherInitials,
        type,
        // Le type est libre côté IUT : seule une forme franchement inattendue
        // (aucun intitulé exploitable) mérite d'être signalée.
        degraded: subjectLabel.length === 0,
    };
}

/**
 * Isole l'intitulé lisible du reste du SUMMARY.
 * Avec tiret : tout ce qui suit le premier ` - `. Sans tiret : on retire
 * les répétitions du code en tête.
 */
function extractLabel(middle: string[], subjectCode: string): string {
    const rest = middle.join(" ");
    if (rest.length === 0) return subjectCode;

    const separatorIndex = rest.indexOf(" - ");
    if (separatorIndex !== -1) {
        const label = rest.slice(separatorIndex + 3).trim();
        if (label.length > 0) return label;
    }

    // Pas de tiret : `SCO ACCUEIL/Rentree` → `ACCUEIL/Rentree`, `FERIE FERIE` → `FERIE`
    const withoutCode = middle.filter((token) => token !== subjectCode);
    if (withoutCode.length > 0) return withoutCode.join(" ").trim();

    return subjectCode;
}
