// ============================================
// 📁 src/sync/ics/normalize.ts
// Interprétation du contenu textuel des événements ICS
// ============================================

import { createHash } from "node:crypto";
import type { LessonType } from "../../db/schema.js";
import { isKnownRoom } from "./rooms.reference.js";
import type { ParsedLesson, RawIcsEvent } from "./types.js";

/**
 * Valeur utilisée par l'IUT pour « pas de salle » (jours fériés notamment).
 */
const NO_ROOM = ".";

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

export interface LocationParts {
    roomNames: string[];
    unknownRooms: string[];
}

/**
 * Interprète un LOCATION.
 *
 * Formats rencontrés :
 *   `R52`, `103`   → une salle
 *   `AC`, `AB`     → amphithéâtres C et B
 *   `108-9`        → salles 108 **et** 109
 *   `111-2`        → salles 111 et 112
 *   `.` ou vide    → aucune salle
 */
export function parseLocation(location: string): LocationParts {
    const cleaned = location.trim();
    if (cleaned.length === 0 || cleaned === NO_ROOM) {
        return { roomNames: [], unknownRooms: [] };
    }

    const candidates = expandRoomRange(cleaned).map(normalizeRoomName);

    const roomNames: string[] = [];
    const unknownRooms: string[] = [];

    for (const candidate of candidates) {
        if (candidate.length === 0) continue;
        if (isKnownRoom(candidate)) {
            if (!roomNames.includes(candidate)) roomNames.push(candidate);
        } else if (!unknownRooms.includes(candidate)) {
            unknownRooms.push(candidate);
        }
    }

    return { roomNames, unknownRooms };
}

/**
 * Développe une notation abrégée de deux salles.
 *
 * Le suffixe remplace la fin du premier nom : `108-9` → `108` + `109`,
 * `111-2` → `111` + `112`, `104-5` → `104` + `105`.
 * (L'ancienne implémentation faisait « premier numéro + 1 », ce qui ne
 * tombait juste que par coïncidence sur les salles actuelles.)
 */
export function expandRoomRange(location: string): string[] {
    const separatorIndex = location.indexOf("-");
    if (separatorIndex === -1) return [location];

    const base = location.slice(0, separatorIndex).trim();
    const suffix = location.slice(separatorIndex + 1).trim();

    if (base.length === 0 || suffix.length === 0 || suffix.length >= base.length) {
        return [location];
    }

    const second = base.slice(0, base.length - suffix.length) + suffix;
    return [base, second];
}

/**
 * Normalise un nom de salle isolé : `AC` → `AmphC`, `AmpB` → `AmphB`.
 */
export function normalizeRoomName(room: string): string {
    const cleaned = room.trim();
    if (cleaned.length === 0) return "";

    const amphi = cleaned.match(/^(?:A|Amp|Amph)([A-Z])$/i);
    if (amphi) return `Amph${amphi[1]!.toUpperCase()}`;

    return cleaned;
}

/**
 * Construit un cours exploitable à partir d'un VEVENT.
 */
export function toParsedLesson(event: RawIcsEvent): ParsedLesson {
    const summary = parseSummary(event.summary);
    const location = parseLocation(event.location);

    return {
        start: event.start,
        end: event.end,
        type: summary.type,
        subjectCode: summary.subjectCode,
        subjectLabel: summary.subjectLabel,
        teacherInitials: summary.teacherInitials,
        roomNames: location.roomNames,
        unknownRooms: location.unknownRooms,
        rawSummary: event.summary.slice(0, 255),
        rawLocation: event.location,
        degraded: summary.degraded,
    };
}

/**
 * Empreinte d'un cours, indépendante du fichier qui le publie.
 *
 * C'est la clé du dédoublonnage : un CM de promo apparaît à l'identique dans
 * l'ICS de chaque sous-groupe, il ne doit être stocké qu'une fois.
 */
export function computeDedupKey(lesson: ParsedLesson): string {
    const canonical = [
        lesson.start.toISOString(),
        lesson.end.toISOString(),
        lesson.type,
        lesson.subjectCode,
        lesson.teacherInitials ?? "",
        [...lesson.roomNames].sort().join("+"),
    ].join("|");

    return createHash("sha1").update(canonical).digest("hex");
}
