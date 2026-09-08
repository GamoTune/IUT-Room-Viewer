// ============================================
// 📁 src/sync/pdf/parse.ts
// Lecture d'un emploi du temps au format PDF
// ============================================

import type { Year } from "../../entities/enums.js";
import { subGroupCodes } from "../groups.js";
import { addDays, parisToUtc } from "../time.js";
import type { ParsedLesson } from "../types.js";
import { buildCells, type Cell } from "./cells.js";
import { readPage } from "./geometry.js";
import { buildBands, calibrateTime, xToMinutes, DAY_LABELS, type Band, type TimeScale } from "./grid.js";
import { readCell } from "./content.js";

/** En-tête du document : semaine et dates réelles. */
export interface TimetableHeader {
    weekNumber: number;
    isoWeek: number;
    monday: Date;
}

export interface ParsedTimetable {
    header: TimetableHeader | null;
    lessons: ParsedLesson[];
    /** Cases dont le contenu n'a pas pu être interprété. */
    unreadable: string[];
    /** Salles citées mais absentes du référentiel. */
    unknownRooms: string[];
    /** Erreur maximale de la calibration horaire, en minutes. */
    calibrationError: number;
}

/**
 * Lit un emploi du temps et en extrait les cours.
 *
 * Toute la géométrie du document est exploitée : la grille horaire donne les
 * horaires, les traits donnent les limites des cases, et la position verticale
 * d'une case désigne le ou les groupes concernés.
 */
export async function parseTimetable(data: Uint8Array, year: Year): Promise<ParsedTimetable> {
    const page = await readPage(data);
    const scale = calibrateTime(page.items);
    const bands = buildBands(page, scale);
    const header = readHeader(page.items.map((item) => item.text));

    const lessons: ParsedLesson[] = [];
    const unreadable: string[] = [];
    const unknownRooms = new Set<string>();

    for (const cell of buildCells(page, scale, bands)) {
        // Une case hors des bandes de groupe n'est pas un cours : l'en-tête
        // horaire est peinte comme le reste.
        const covered = bands.filter((band) => overlaps(cell, band));
        const day = covered[0]?.day;
        if (!day) continue;

        const groupCodes = coveredGroups(cell, covered);
        if (groupCodes.length === 0) continue;

        const content = readCell(toLines(cell));

        if (content.degraded) {
            if (content.raw.length > 0) unreadable.push(`${day} — ${content.raw}`);
            continue;
        }

        for (const room of content.unknownRooms) unknownRooms.add(room);

        const start = xToMinutes(scale, cell.left);
        const end = xToMinutes(scale, cell.right);
        if (end <= start) continue;

        const date = header ? addDays(header.monday, DAY_LABELS.indexOf(day)) : null;
        if (!date) continue;

        lessons.push({
            start: parisToUtc(date, 8 * 60 + start),
            end: parisToUtc(date, 8 * 60 + end),
            type: content.type === "OTHER" ? inferType(cell, covered, groupCodes) : content.type,
            subjectCode: content.subjectCode,
            subjectLabel: content.subjectLabel || content.subjectCode,
            teacherName: content.teacherName,
            roomNames: content.roomNames,
            unknownRooms: content.unknownRooms,
            groupCodes,
            rawContent: content.raw,
            degraded: false,
        });
    }

    return {
        header,
        lessons,
        unreadable,
        unknownRooms: [...unknownRooms],
        calibrationError: scale.maxErrorMinutes,
    };
}

/**
 * Déduit le type d'un cours de la portée de sa case.
 *
 * Les documents d'année n'écrivent pas le type : il se lit dans la structure.
 * Un cours suivi par toute une promotion se donne en amphithéâtre — c'est un
 * cours magistral ; un groupe entier suit un TD ; un demi-groupe, un TP.
 */
function inferType(cell: Cell, covered: Band[], groupCodes: string[]): ParsedLesson["type"] {
    const groups = new Set(covered.map((band) => band.groupCode).filter(Boolean));
    if (groups.size > 1) return "CM";

    const band = covered[0];
    if (!band) return "OTHER";

    const height = band.bottom - band.top;
    const overlap = Math.min(cell.bottom, band.bottom) - Math.max(cell.top, band.top);

    // Une case qui ne couvre que la moitié de la bande s'adresse à un seul
    // sous-groupe : c'est la marque d'un travail pratique.
    if (overlap < height * 0.7 || groupCodes.length === 1) return "TP";

    return "TD";
}

/** Une case recouvre-t-elle une bande de façon significative ? */
function overlaps(cell: Cell, band: Band): boolean {
    return Math.min(cell.bottom, band.bottom) - Math.max(cell.top, band.top) > 1;
}

/** Lignes de texte d'une case, dans l'ordre de lecture. */
function toLines(cell: Cell): string[] {
    const sorted = [...cell.items].sort((a, b) => a.y - b.y || a.x - b.x);
    const lines: Array<{ y: number; parts: string[] }> = [];

    for (const item of sorted) {
        const line = lines.find((entry) => Math.abs(entry.y - item.y) < 3);
        if (line) line.parts.push(item.text);
        else lines.push({ y: item.y, parts: [item.text] });
    }

    return lines.map((line) => line.parts.join(" "));
}

/**
 * Groupes concernés par une case, déduits des bandes qu'elle recouvre.
 *
 * Une case qui couvre toute la bande d'un groupe s'adresse à ses deux
 * sous-groupes ; une case qui n'en couvre que la moitié désigne le sous-groupe
 * du haut (`a`) ou du bas (`b`) — c'est ainsi que les emplois du temps
 * ordonnent les groupes.
 */
function coveredGroups(cell: Cell, bands: Band[]): string[] {
    const codes: string[] = [];

    for (const band of bands) {
        if (!band.groupCode) continue;

        const overlapTop = Math.max(cell.top, band.top);
        const overlapBottom = Math.min(cell.bottom, band.bottom);
        const overlap = overlapBottom - overlapTop;
        if (overlap <= 1) continue;

        // Un document de sous-groupe nomme déjà sa bande `G1a` : rien à déduire.
        if (/[ab]$/.test(band.groupCode)) {
            codes.push(band.groupCode);
            continue;
        }

        const height = band.bottom - band.top;
        const mainGroup = Number(band.groupCode.slice(1));
        const [first, second] = subGroupCodes(mainGroup) as [string, string];

        // Couverture quasi complète : les deux sous-groupes
        if (overlap > height * 0.7) {
            codes.push(first, second);
            continue;
        }

        const middle = (band.top + band.bottom) / 2;
        codes.push(overlapTop < middle - 1 ? first : second);
    }

    return [...new Set(codes)];
}

/**
 * Lit l'en-tête : `Semaine 1 (36) : du 31/08/2026 au 05/09/2026`.
 * Il donne les dates réelles, qu'il serait hasardeux de recalculer.
 */
export function readHeader(texts: string[]): TimetableHeader | null {
    const line = texts.find((text) => /Semaine\s+\d+/i.test(text));
    if (!line) return null;

    const matched = line.match(
        /Semaine\s+(\d+)\s*\((\d+)\)\s*:\s*du\s+(\d{2})\/(\d{2})\/(\d{4})/i,
    );
    if (!matched) return null;

    const [, week, isoWeek, day, month, year] = matched as unknown as string[];

    return {
        weekNumber: Number(week),
        isoWeek: Number(isoWeek),
        monday: new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
    };
}

export type { TimeScale };
