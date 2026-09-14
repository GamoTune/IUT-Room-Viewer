// ============================================
// 📁 src/sync/pdf/cells.ts
// Découpe des cases de la grille
// ============================================

import type { FilledRect, PageGeometry, TextItem } from "./geometry.js";
import { gridLeft, type Band, type TimeScale } from "./grid.js";

/** Une case : un cours, avec ses bornes dans la grille. */
export interface Cell {
    left: number;
    right: number;
    top: number;
    bottom: number;
    items: TextItem[];
}

/** Tolérance de comparaison des bornes, en points. */
const EPSILON = 1.5;

/**
 * Relève les cases de cours.
 *
 * Les emplois du temps peignent chaque cours dans un rectangle de couleur :
 * ses bornes donnent directement l'horaire et la portée du cours, sans avoir à
 * les déduire de la position du texte ni des graduations de la grille.
 */
export function buildCells(page: PageGeometry, scale: TimeScale, bands: Band[]): Cell[] {
    if (bands.length === 0) return [];

    const left = gridLeft(scale);
    const right = left + 24 * scale.slotWidth;
    const top = Math.min(...bands.map((band) => band.top));
    const bottom = Math.max(...bands.map((band) => band.bottom));

    const painted = deduplicate(
        page.rects.filter(
            (rect) =>
                rect.left >= left - EPSILON &&
                rect.right <= right + EPSILON &&
                rect.top >= top - EPSILON &&
                rect.bottom <= bottom + EPSILON &&
                rect.right - rect.left > 2 &&
                rect.bottom - rect.top > 2,
        ),
    );

    return painted.map((rect) => ({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        items: page.items.filter((item) => isInside(item, rect)),
    }));
}

/**
 * Un fragment appartient à la case qui le contient : le test porte sur son coin
 * supérieur gauche, seul point dont la position soit sûre.
 */
function isInside(item: TextItem, rect: FilledRect): boolean {
    return (
        item.x >= rect.left - EPSILON &&
        item.x < rect.right &&
        item.y >= rect.top - EPSILON &&
        item.y < rect.bottom
    );
}

/**
 * Écarte les rectangles superposés : le fond et son cadre sont peints
 * séparément, à quelques dixièmes de point près.
 */
function deduplicate(rects: FilledRect[]): FilledRect[] {
    const unique: FilledRect[] = [];

    for (const rect of rects) {
        const twin = unique.find(
            (candidate) =>
                Math.abs(candidate.left - rect.left) < EPSILON &&
                Math.abs(candidate.right - rect.right) < EPSILON &&
                Math.abs(candidate.top - rect.top) < EPSILON &&
                Math.abs(candidate.bottom - rect.bottom) < EPSILON,
        );

        if (!twin) unique.push(rect);
    }

    return unique.sort((a, b) => a.top - b.top || a.left - b.left);
}
