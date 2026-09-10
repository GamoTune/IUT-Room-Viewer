// ============================================
// 📁 src/sync/pdf/content.ts
// Interprétation du contenu d'une case
// ============================================

import type { LessonType } from "../../entities/enums.js";
import { parseLocation } from "../rooms.js";

/** Ce qu'on lit dans une case, avant de savoir qui la suit. */
export interface CellContent {
    subjectCode: string;
    subjectLabel: string;
    type: LessonType;
    teacherName: string | null;
    roomNames: string[];
    unknownRooms: string[];
    raw: string;
    /** `true` quand la case ne suit aucune des deux formes connues. */
    degraded: boolean;
}

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

/**
 * Un code de matière : `R1.01`, `S5A.01`, `R3.08`, et les codes non numériques
 * que l'IUT emploie pour les temps hors module — `S3.St` pour le stage.
 */
const SUBJECT_CODE = /^[RS]\d[A-Z]?\.[A-Za-z0-9]{2,3}$/;

/**
 * Une SAÉ se distingue d'une ressource par son préfixe : `S5A.01` contre
 * `R5A.04`. C'est le seul marqueur fiable — le document ne qualifie pas ces
 * créneaux, et certains portent malgré tout un enseignant.
 */
export function isSaeCode(code: string): boolean {
    return code.startsWith("S");
}

/**
 * Lit une case, quelle que soit sa forme.
 *
 * Les documents mélangent deux présentations :
 *   `R5A.06 - SM - 111`                    (compacte, cours d'un groupe)
 *   `R1.01 R1.01 - Initiation au           (détaillée, cours de promotion)
 *    développement / Cours / Onete C. / AC`
 *
 * Une case non reconnue n'est jamais jetée : elle est conservée en mode
 * dégradé, pour que l'occupation de la salle reste comptabilisée.
 */
export function readCell(lines: string[]): CellContent {
    const cleaned = lines.map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line.length > 0);
    const raw = cleaned.join(" / ");

    if (cleaned.length === 0) {
        return emptyContent(raw);
    }

    const compact = readCompact(cleaned[0]!, raw);
    if (compact) return compact;

    return readDetailed(cleaned, raw);
}

/**
 * Forme compacte : `CODE - ENSEIGNANT - SALLE`, sur une seule ligne.
 * L'enseignant y est réduit à ses initiales, et vaut parfois un nom de groupe
 * (`S5A.02 - G7 - 111-2`) quand la séance n'a pas d'enseignant attitré.
 */
function readCompact(line: string, raw: string): CellContent | null {
    const parts = line.split(" - ").map((part) => part.trim());
    if (parts.length !== 3) return null;

    const [code, teacher, room] = parts as [string, string, string];
    if (!SUBJECT_CODE.test(code)) return null;

    const location = parseLocation(room);

    return {
        subjectCode: code,
        subjectLabel: code,
        type: "OTHER",
        teacherName: teacher.length > 0 && teacher !== "." ? teacher : null,
        roomNames: location.roomNames,
        unknownRooms: location.unknownRooms,
        raw,
        degraded: false,
    };
}

/**
 * Forme détaillée : le code et l'intitulé, puis le type, l'enseignant en toutes
 * lettres et la salle, chacun sur sa ligne.
 *
 * L'intitulé peut déborder sur plusieurs lignes ; les trois dernières lignes
 * sont donc lues depuis la fin.
 */
function readDetailed(lines: string[], raw: string): CellContent {
    // Le type est écrit seul en tête de ligne, mais sa place varie et la salle
    // le suit parfois sur la même ligne (`TP 105`).
    const typeIndex = lines.findIndex((line) => TYPE_MAP[firstWord(line)] !== undefined);
    const type = typeIndex === -1 ? "OTHER" : TYPE_MAP[firstWord(lines[typeIndex]!)]!;

    const titleLines = typeIndex === -1 ? lines.slice(0, -2) : lines.slice(0, typeIndex);
    const title = titleLines.join(" ").replace(/\s+/g, " ").trim();

    // Tout ce qui suit le titre peut porter la salle ou l'enseignant
    const tail = typeIndex === -1 ? lines.slice(-2) : lines.slice(typeIndex);
    const location = findLocation(tail, type);
    const teacherName = findTeacher(tail, location.text);

    const code = title.split(" ").find((token) => SUBJECT_CODE.test(token));
    const label = extractLabel(title, code);

    return {
        subjectCode: code ?? fallbackCode(title),
        subjectLabel: label,
        type,
        teacherName,
        roomNames: location.roomNames,
        unknownRooms: location.unknownRooms,
        raw,
        // Un titre sans code ni intitulé lisible mérite d'être signalé
        degraded: code === undefined && label.length === 0,
    };
}

/** Premier mot d'une ligne, en minuscules. */
function firstWord(line: string): string {
    return (line.split(" ")[0] ?? "").toLowerCase();
}

/**
 * Cherche la salle dans les lignes qui suivent le titre, quelle que soit sa
 * position : elle peut être seule sur sa ligne ou accolée au type.
 */
function findLocation(lines: string[], type: LessonType): {
    roomNames: string[];
    unknownRooms: string[];
    text: string | null;
} {
    for (const line of [...lines].reverse()) {
        for (const token of line.split(" ")) {
            if (TYPE_MAP[token.toLowerCase()] !== undefined) continue;

            const parsed = parseLocation(token);
            if (parsed.roomNames.length > 0) {
                return { ...parsed, text: token };
            }
        }
    }

    void type;
    return { roomNames: [], unknownRooms: [], text: null };
}

/**
 * L'enseignant est ce qui reste : une ligne qui n'annonce ni le type ni la
 * salle. Un point tient lieu d'absence.
 */
function findTeacher(lines: string[], roomText: string | null): string | null {
    for (const line of [...lines].reverse()) {
        const cleaned = line
            .split(" ")
            .filter((token) => token !== roomText && TYPE_MAP[token.toLowerCase()] === undefined)
            .join(" ")
            .trim();

        if (cleaned.length > 0 && cleaned !== ".") return cleaned;
    }

    return null;
}

/**
 * Isole l'intitulé : `R1.01 R1.01 - Initiation au développement` →
 * `Initiation au développement`. Sans tiret, on retire les répétitions du code.
 */
function extractLabel(title: string, code: string | undefined): string {
    const separator = title.indexOf(" - ");
    if (separator !== -1) {
        const label = title.slice(separator + 3).trim();
        if (label.length > 0) return label;
    }

    if (code) {
        const withoutCode = title
            .split(" ")
            .filter((token) => token !== code)
            .join(" ")
            .trim();
        if (withoutCode.length > 0) return withoutCode;
        return code;
    }

    return title;
}

/**
 * Les mentions administratives n'ont pas de code : `FERIE`, `SCO`, `VACANCES`.
 * Leur premier mot en tient lieu.
 */
function fallbackCode(title: string): string {
    const first = title.split(" ")[0]?.toUpperCase() ?? "";
    return first.length > 0 ? first.slice(0, 20) : "INCONNU";
}

function emptyContent(raw: string): CellContent {
    return {
        subjectCode: "INCONNU",
        subjectLabel: "",
        type: "OTHER",
        teacherName: null,
        roomNames: [],
        unknownRooms: [],
        raw,
        degraded: true,
    };
}
