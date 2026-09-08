// ============================================
// 📁 src/sync/pdf/geometry.ts
// Extraction du texte et des traits d'un PDF, en coordonnées d'affichage
// ============================================

import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Un fragment de texte, positionné dans le repère d'affichage :
 * origine en haut à gauche, rotation de la page déjà appliquée.
 */
export interface TextItem {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Un trait du tableau, horizontal ou vertical. */
export interface Line {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface PageGeometry {
    width: number;
    height: number;
    items: TextItem[];
    /** Traits verticaux, triés par abscisse. */
    verticals: Line[];
    /** Traits horizontaux, triés par ordonnée. */
    horizontals: Line[];
}

type Matrix = [number, number, number, number, number, number];

function multiply(a: Matrix, b: Matrix): Matrix {
    return [
        a[0] * b[0] + a[1] * b[2],
        a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2],
        a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4],
        a[4] * b[1] + a[5] * b[3] + b[5],
    ];
}

function applyPoint(m: Matrix, x: number, y: number): [number, number] {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Lit une page et rend son contenu dans le repère d'affichage.
 *
 * Les EDT de l'IUT sont produits par iText avec une rotation : les traits sont
 * décrits dans un espace tourné, et seule la matrice du viewport permet de les
 * remettre en correspondance avec le texte.
 */
export async function readPage(data: Uint8Array, pageNumber = 1): Promise<PageGeometry> {
    const doc = await getDocument({
        data,
        // Aucune police n'est rendue : on n'a besoin que des positions.
        isEvalSupported: false,
        useSystemFonts: false,
    }).promise;

    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const transform = viewport.transform as Matrix;

    const items: TextItem[] = [];
    const content = await page.getTextContent();

    for (const raw of content.items) {
        if (!("str" in raw) || raw.str.trim().length === 0) continue;

        const itemMatrix = raw.transform as Matrix;
        const [x, y] = applyPoint(transform, itemMatrix[4], itemMatrix[5]);

        items.push({
            text: raw.str,
            x,
            // `y` désigne la ligne de base ; on remonte d'une hauteur de glyphe
            // pour obtenir le haut du fragment.
            y: y - raw.height,
            width: raw.width,
            height: raw.height,
        });
    }

    const verticals: Line[] = [];
    const horizontals: Line[] = [];
    const operators = await page.getOperatorList();

    const stack: Matrix[] = [];
    let ctm: Matrix = [1, 0, 0, 1, 0, 0];

    for (let i = 0; i < operators.fnArray.length; i++) {
        const fn = operators.fnArray[i];
        const args = operators.argsArray[i];

        if (fn === OPS.save) {
            stack.push([...ctm] as Matrix);
        } else if (fn === OPS.restore) {
            ctm = stack.pop() ?? ctm;
        } else if (fn === OPS.transform) {
            ctm = multiply(args as Matrix, ctm);
        } else if (fn === OPS.constructPath) {
            collectPath(args as [number[], number[]], ctm, transform, verticals, horizontals);
        }
    }

    verticals.sort((a, b) => a.x1 - b.x1);
    horizontals.sort((a, b) => a.y1 - b.y1);

    return { width: viewport.width, height: viewport.height, items, verticals, horizontals };
}

/**
 * Convertit un chemin PDF en segments d'affichage, en ne gardant que les
 * traits franchement horizontaux ou verticaux : le tableau n'est fait que
 * de ceux-là, les obliques éventuelles n'apportent rien.
 */
function collectPath(
    [fns, coords]: [number[], number[]],
    ctm: Matrix,
    transform: Matrix,
    verticals: Line[],
    horizontals: Line[],
): void {
    const full = multiply(ctm, transform);
    let cursor: [number, number] = [0, 0];
    let index = 0;

    for (const fn of fns) {
        if (fn === OPS.moveTo) {
            cursor = [coords[index++]!, coords[index++]!];
        } else if (fn === OPS.lineTo) {
            const next: [number, number] = [coords[index++]!, coords[index++]!];
            const a = applyPoint(full, cursor[0], cursor[1]);
            const b = applyPoint(full, next[0], next[1]);

            const dx = Math.abs(a[0] - b[0]);
            const dy = Math.abs(a[1] - b[1]);

            if (dx < 0.6 && dy > 1) {
                verticals.push({ x1: a[0], y1: Math.min(a[1], b[1]), x2: a[0], y2: Math.max(a[1], b[1]) });
            } else if (dy < 0.6 && dx > 1) {
                horizontals.push({ x1: Math.min(a[0], b[0]), y1: a[1], x2: Math.max(a[0], b[0]), y2: a[1] });
            }

            cursor = next;
        } else if (fn === OPS.curveTo) {
            index += 6;
            cursor = [coords[index - 2]!, coords[index - 1]!];
        } else if (fn === OPS.rectangle) {
            const [x, y, w, h] = coords.slice(index, index + 4) as number[];
            index += 4;
            const corners: Array<[number, number]> = [
                applyPoint(full, x!, y!),
                applyPoint(full, x! + w!, y!),
                applyPoint(full, x! + w!, y! + h!),
                applyPoint(full, x!, y! + h!),
            ];
            for (let k = 0; k < 4; k++) {
                const a = corners[k]!;
                const b = corners[(k + 1) % 4]!;
                if (Math.abs(a[0] - b[0]) < 0.6) {
                    verticals.push({ x1: a[0], y1: Math.min(a[1], b[1]), x2: a[0], y2: Math.max(a[1], b[1]) });
                } else if (Math.abs(a[1] - b[1]) < 0.6) {
                    horizontals.push({ x1: Math.min(a[0], b[0]), y1: a[1], x2: Math.max(a[0], b[0]), y2: a[1] });
                }
            }
        } else {
            index += 2;
        }
    }
}
