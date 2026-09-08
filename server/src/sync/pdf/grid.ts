// ============================================
// 📁 src/sync/pdf/grid.ts
// Reconstitution de la grille d'un emploi du temps
// ============================================

import type { Line, PageGeometry, TextItem } from "./geometry.js";

/** Jours affichés en tête de ligne, dans l'ordre. */
export const DAY_LABELS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"] as const;
export type DayLabel = (typeof DAY_LABELS)[number];

/** Conversion d'une abscisse en minutes depuis 8:00. */
export interface TimeScale {
    /** minutes = (x - origin) / pointsPerMinute */
    origin: number;
    pointsPerMinute: number;
    /** Largeur d'une demi-heure, en points. */
    slotWidth: number;
    /** Erreur maximale de la calibration, en minutes. */
    maxErrorMinutes: number;
}

/** Une bande horizontale : un groupe, un jour. */
export interface Band {
    day: DayLabel;
    /** Code du groupe (`G1`), ou `null` si le document n'en affiche pas. */
    groupCode: string | null;
    top: number;
    bottom: number;
}

/** Une case de la grille, délimitée horizontalement et verticalement. */
export interface Cell {
    band: Band;
    left: number;
    right: number;
    top: number;
    bottom: number;
    /** `a`, `b`, ou `null` quand la case couvre le groupe entier. */
    subGroup: string | null;
    items: TextItem[];
}

export interface Grid {
    scale: TimeScale;
    bands: Band[];
    cells: Cell[];
    /** Semaine et dates lues dans l'en-tête du document. */
    header: TimetableHeader | null;
}

export interface TimetableHeader {
    weekNumber: number;
    isoWeek: number;
    from: Date;
    to: Date;
}

/** Tolérance de regroupement des traits dédoublés, en points. */
const CLUSTER_TOLERANCE = 1.5;

/**
 * Regroupe des coordonnées proches : les traits du tableau sont souvent
 * tracés deux ou trois fois, à quelques dixièmes de point d'écart.
 */
export function cluster(values: number[], tolerance = CLUSTER_TOLERANCE): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const groups: number[][] = [];

    for (const value of sorted) {
        const last = groups[groups.length - 1];
        if (last && value - last[last.length - 1]! <= tolerance) last.push(value);
        else groups.push([value]);
    }

    return groups.map((group) => group.reduce((sum, value) => sum + value, 0) / group.length);
}

/**
 * Calibre l'échelle horaire sur les libellés de l'en-tête (`8:00` … `19:30`).
 *
 * Une régression linéaire sur leurs centres suffit : la grille est régulière,
 * l'erreur mesurée sur les documents de l'IUT est inférieure à une minute.
 */
export function calibrateTime(items: TextItem[]): TimeScale {
    const labels = items
        .filter((item) => /^\d{1,2}:\d{2}$/.test(item.text.trim()))
        .map((item) => ({
            center: item.x + item.width / 2,
            minutes: toMinutes(item.text.trim()),
            y: item.y,
        }));

    if (labels.length < 4) {
        throw new Error("En-tête horaire introuvable : le document n'a pas la forme attendue");
    }

    // Les libellés apparaissent en haut et en bas ; ceux du haut suffisent.
    const topY = Math.min(...labels.map((label) => label.y));
    const header = labels.filter((label) => label.y < topY + 20);

    const count = header.length;
    const meanX = header.reduce((sum, label) => sum + label.center, 0) / count;
    const meanMinutes = header.reduce((sum, label) => sum + label.minutes, 0) / count;

    const covariance = header.reduce(
        (sum, label) => sum + (label.center - meanX) * (label.minutes - meanMinutes),
        0,
    );
    const variance = header.reduce((sum, label) => sum + (label.center - meanX) ** 2, 0);

    // minutes = slope * x + intercept
    const slope = covariance / variance;
    const intercept = meanMinutes - slope * meanX;

    const maxErrorMinutes = Math.max(
        ...header.map((label) => Math.abs(slope * label.center + intercept - label.minutes)),
    );

    return {
        origin: -intercept / slope,
        pointsPerMinute: 1 / slope,
        slotWidth: 30 / slope,
        maxErrorMinutes,
    };
}

function toMinutes(label: string): number {
    const [hours, minutes] = label.split(":").map(Number);
    return (hours! * 60 + minutes!) - 8 * 60;
}

/**
 * Convertit une abscisse en minutes depuis 8:00, arrondies au quart d'heure.
 *
 * Les libellés horaires sont centrés sur leur colonne : le bord gauche de la
 * colonne de 8:00 se trouve une demi-colonne avant l'origine calculée.
 */
export function xToMinutes(scale: TimeScale, x: number): number {
    const raw = (x - scale.origin) / scale.pointsPerMinute + 15;
    return Math.round(raw / 15) * 15;
}

/** Abscisse du bord gauche de la grille, où commence la colonne de 8:00. */
export function gridLeft(scale: TimeScale): number {
    return scale.origin - scale.slotWidth / 2;
}

/**
 * Découpe le tableau en bandes : une par groupe et par jour.
 *
 * Les frontières viennent des traits horizontaux longs, et non d'un calcul :
 * A1 compte trois groupes par journée, A2 et A3 en comptent deux.
 */
export function buildBands(page: PageGeometry, scale: TimeScale): Band[] {
    // Triés par position : l'ordre des fragments dans le fichier n'est pas
    // l'ordre d'affichage.
    const days = page.items
        .filter((item) => (DAY_LABELS as readonly string[]).includes(item.text.trim()))
        .sort((a, b) => a.y - b.y)
        .map((item) => item.text.trim() as DayLabel)
        .filter((day, index, all) => all.indexOf(day) === index);

    if (days.length === 0) return [];

    // Les frontières de journée traversent toute la largeur ; les séparateurs
    // internes aux cases sont bien plus courts. Un critère relatif évite de
    // dépendre des marges exactes du document.
    const gridWidth = 24 * scale.slotWidth;
    const rows = cluster(
        page.horizontals.filter((line) => line.x2 - line.x1 > gridWidth * 0.6).map((line) => line.y1),
    ).sort((a, b) => a - b);

    const groups = page.items
        .filter((item) => /^G\d$/i.test(item.text.trim()))
        .map((item) => ({ code: item.text.trim().toUpperCase(), y: item.y }))
        .sort((a, b) => a.y - b.y);

    // Une bande par groupe et par jour : celles qui portent un libellé de groupe
    const candidates: Array<{ groupCode: string; top: number; bottom: number }> = [];

    for (let i = 0; i < rows.length - 1; i++) {
        const top = rows[i]!;
        const bottom = rows[i + 1]!;
        const group = groups.find((entry) => entry.y >= top - 4 && entry.y < bottom);
        if (group) candidates.push({ groupCode: group.code, top, bottom });
    }

    // Les journées se suivent, chacune découpée dans le même nombre de groupes :
    // l'ordre vertical suffit à les attribuer, sans dépendre de la position du
    // libellé du jour, qui est centré sur la bande du milieu.
    const groupsPerDay = new Set(candidates.map((band) => band.groupCode)).size;
    if (groupsPerDay === 0) return [];

    return normalizeHeights(candidates).map((band, index) => ({
        ...band,
        day: days[Math.floor(index / groupsPerDay)] ?? days[days.length - 1]!,
    }));
}

/**
 * Ramène les bandes à leur hauteur commune.
 *
 * Le trait qui sépare l'en-tête de la première bande manque dans certains
 * documents : sans correction, la ligne des heures serait lue comme des cours
 * du lundi. Toutes les bandes ayant la même hauteur, l'anomalie se corrige
 * d'elle-même.
 */
function normalizeHeights<T extends { top: number; bottom: number }>(bands: T[]): T[] {
    if (bands.length < 3) return bands;

    const heights = bands.map((band) => band.bottom - band.top).sort((a, b) => a - b);
    const median = heights[Math.floor(heights.length / 2)]!;

    return bands.map((band) =>
        band.bottom - band.top > median * 1.1 ? { ...band, top: band.bottom - median } : band,
    );
}

