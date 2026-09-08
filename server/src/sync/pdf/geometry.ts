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

/** Une case colorée : c'est ainsi que les emplois du temps dessinent les cours. */
export interface FilledRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface PageGeometry {
    width: number;
    height: number;
    items: TextItem[];
    /** Traits verticaux, triés par abscisse. */
    verticals: Line[];
    /** Traits horizontaux, triés par ordonnée. */
    horizontals: Line[];
    /** Rectangles remplis, triés de haut en bas puis de gauche à droite. */
    rects: FilledRect[];
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
    const rects: FilledRect[] = [];
    const operators = await page.getOperatorList();

    const stack: Matrix[] = [];
    let ctm: Matrix = [1, 0, 0, 1, 0, 0];
    let lastPath: FilledRect | null = null;

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
            lastPath = collectPath(args as PathArgs, ctm, transform, verticals, horizontals, rects);
        } else if (fn === OPS.fill || fn === OPS.eoFill || fn === OPS.fillStroke) {
            // Le fond coloré d'une case n'est identifiable qu'à la peinture :
            // c'est l'opérateur qui suit la construction du chemin.
            if (lastPath) rects.push(lastPath);
            lastPath = null;
        }
    }

    verticals.sort((a, b) => a.x1 - b.x1);
    horizontals.sort((a, b) => a.y1 - b.y1);
    rects.sort((a, b) => a.top - b.top || a.left - b.left);

    return { width: viewport.width, height: viewport.height, items, verticals, horizontals, rects };
}

/**
 * pdfjs décrit les chemins sous deux formes selon sa version et les options de
 * lecture : soit une liste d'opérateurs accompagnée de coordonnées à plat, soit
 * une opération de peinture accompagnée de sous-chemins compacts. Les deux sont
 * acceptées ici, pour ne pas dépendre d'un détail d'implémentation.
 */
type PathArgs = unknown[];

/** Coordonnées attendues après chaque code, dans la forme compacte. */
const COMPACT_SIZES: Record<number, number> = { 0: 2, 1: 2, 2: 6, 3: 4, 4: 0 };
const COMPACT_MOVE_TO = 0;
const COMPACT_LINE_TO = 1;

/**
 * Convertit un chemin en géométrie d'affichage.
 *
 * Seuls les segments franchement horizontaux ou verticaux sont retenus : un
 * emploi du temps n'est fait que de cela, et les obliques éventuelles
 * n'apportent rien à la lecture de la grille.
 */
function collectPath(
    args: PathArgs,
    ctm: Matrix,
    transform: Matrix,
    verticals: Line[],
    horizontals: Line[],
    rects: FilledRect[],
): FilledRect | null {
    const full = multiply(ctm, transform);

    if (Array.isArray(args[0])) {
        return readOperatorForm(args[0] as number[], args[1] as ArrayLike<number>, full, verticals, horizontals);
    }

    readCompactForm(args, full, verticals, horizontals, rects);
    return null;
}

/** Forme « opérateurs + coordonnées » : `[[moveTo, lineTo, …], [x, y, …]]`. */
function readOperatorForm(
    operations: number[],
    coords: ArrayLike<number>,
    full: Matrix,
    verticals: Line[],
    horizontals: Line[],
): FilledRect | null {
    const points: Array<[number, number]> = [];
    let cursor: [number, number] = [0, 0];
    let index = 0;

    for (const operation of operations) {
        if (operation === OPS.moveTo || operation === OPS.lineTo) {
            const next = applyPoint(full, coords[index]!, coords[index + 1]!);
            if (operation === OPS.lineTo) addSegment(cursor, next, verticals, horizontals);
            cursor = next;
            points.push(next);
            index += 2;
        } else if (operation === OPS.curveTo) {
            index += 6;
            cursor = applyPoint(full, coords[index - 2]!, coords[index - 1]!);
            points.push(cursor);
        } else if (operation === OPS.rectangle) {
            points.push(...addRectangle(coords, index, full, verticals, horizontals));
            index += 4;
        }
    }

    return points.length >= 3 ? toRect(points) : null;
}

/** Les quatre côtés d'un rectangle décrit d'un bloc. */
function addRectangle(
    coords: ArrayLike<number>,
    index: number,
    full: Matrix,
    verticals: Line[],
    horizontals: Line[],
): Array<[number, number]> {
    const [x, y, width, height] = [coords[index]!, coords[index + 1]!, coords[index + 2]!, coords[index + 3]!];
    const corners: Array<[number, number]> = [
        applyPoint(full, x, y),
        applyPoint(full, x + width, y),
        applyPoint(full, x + width, y + height),
        applyPoint(full, x, y + height),
    ];

    for (let i = 0; i < 4; i++) {
        addSegment(corners[i]!, corners[(i + 1) % 4]!, verticals, horizontals);
    }

    return corners;
}

/** Forme compacte : `[peinture, [sous-chemins], boîte]`. */
function readCompactForm(
    args: PathArgs,
    full: Matrix,
    verticals: Line[],
    horizontals: Line[],
    rects: FilledRect[],
): void {
    const paintOperation = args[0] as number;
    const subPaths = (args[1] ?? []) as ArrayLike<ArrayLike<number>>;
    const painted =
        paintOperation === OPS.fill || paintOperation === OPS.fillStroke || paintOperation === OPS.eoFill;

    for (let p = 0; p < subPaths.length; p++) {
        const data = subPaths[p];
        if (!data) continue;

        const points: Array<[number, number]> = [];
        let cursor: [number, number] = [0, 0];
        let index = 0;

        while (index < data.length) {
            const command = data[index]!;
            const size = COMPACT_SIZES[command];
            if (size === undefined) break;

            if (command === COMPACT_MOVE_TO || command === COMPACT_LINE_TO) {
                const next = applyPoint(full, data[index + 1]!, data[index + 2]!);
                if (command === COMPACT_LINE_TO) addSegment(cursor, next, verticals, horizontals);
                cursor = next;
                points.push(next);
            }

            index += 1 + size;
        }

        if (painted && points.length >= 3) addRect(points, rects);
    }
}

/** Classe un segment selon son orientation ; les obliques sont ignorées. */
function addSegment(
    from: [number, number],
    to: [number, number],
    verticals: Line[],
    horizontals: Line[],
): void {
    const dx = Math.abs(from[0] - to[0]);
    const dy = Math.abs(from[1] - to[1]);

    if (dx < 0.6 && dy > 1) {
        verticals.push({ x1: from[0], y1: Math.min(from[1], to[1]), x2: from[0], y2: Math.max(from[1], to[1]) });
    } else if (dy < 0.6 && dx > 1) {
        horizontals.push({ x1: Math.min(from[0], to[0]), y1: from[1], x2: Math.max(from[0], to[0]), y2: from[1] });
    }
}

/** Emprise d'un ensemble de points. */
function toRect(points: Array<[number, number]>): FilledRect {
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);

    return {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
    };
}

/** Enregistre l'emprise d'un contour peint. */
function addRect(points: Array<[number, number]>, rects: FilledRect[]): void {
    const rect = toRect(points);
    if (rect.right - rect.left > 1 && rect.bottom - rect.top > 1) rects.push(rect);
}
