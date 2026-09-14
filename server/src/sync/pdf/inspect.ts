// ============================================
// 📁 src/sync/pdf/inspect.ts
// Diagnostic : montre la grille détectée dans un PDF d'EDT
//
//   bun src/sync/pdf/inspect.ts <fichier.pdf>
// ============================================

import { readPage } from "./geometry.js";

const path = process.argv[2];
if (!path) {
    console.error("usage : bun src/sync/pdf/inspect.ts <fichier.pdf>");
    process.exit(1);
}

const page = await readPage(new Uint8Array(await Bun.file(path).arrayBuffer()));

console.log(`page ${page.width.toFixed(0)} × ${page.height.toFixed(0)}`);
console.log(`fragments de texte : ${page.items.length}`);
console.log(`traits verticaux   : ${page.verticals.length}`);
console.log(`traits horizontaux : ${page.horizontals.length}`);

/** Regroupe des coordonnées proches (les traits sont souvent dédoublés). */
function cluster(values: number[], tolerance = 1.5): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const groups: number[][] = [];

    for (const value of sorted) {
        const last = groups[groups.length - 1];
        if (last && value - last[last.length - 1]! <= tolerance) last.push(value);
        else groups.push([value]);
    }

    return groups.map((group) => group.reduce((sum, v) => sum + v, 0) / group.length);
}

// Les libellés horaires de l'en-tête donnent l'échelle des abscisses
const hours = page.items
    .filter((item) => /^\d{1,2}:\d{2}$/.test(item.text.trim()))
    .map((item) => ({ label: item.text.trim(), center: item.x + item.width / 2, y: item.y }))
    .filter((item) => item.y < Math.min(...page.items.map((i) => i.y)) + 30);

console.log(`\nlibellés horaires en en-tête : ${hours.length}`);
if (hours.length >= 2) {
    const sorted = [...hours].sort((a, b) => a.center - b.center);
    console.log(`   de ${sorted[0]!.label} (x=${sorted[0]!.center.toFixed(1)}) à ${sorted.at(-1)!.label} (x=${sorted.at(-1)!.center.toFixed(1)})`);
}

const longVerticals = page.verticals.filter((line) => line.y2 - line.y1 > 100);
const longHorizontals = page.horizontals.filter((line) => line.x2 - line.x1 > 200);

console.log(`\ncolonnes du tableau (traits verticaux longs) : ${cluster(longVerticals.map((l) => l.x1)).length}`);
console.log("   x =", cluster(longVerticals.map((l) => l.x1)).map((v) => v.toFixed(0)).join("  "));

console.log(`\nlignes du tableau (traits horizontaux longs) : ${cluster(longHorizontals.map((l) => l.y1)).length}`);
console.log("   y =", cluster(longHorizontals.map((l) => l.y1)).map((v) => v.toFixed(0)).join("  "));

const dayLabels = page.items.filter((item) =>
    ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"].includes(item.text.trim()),
);
console.log("\nlibellés de jours :");
for (const label of dayLabels.sort((a, b) => a.y - b.y)) {
    console.log(`   ${label.text.trim().padEnd(10)} y=${label.y.toFixed(0)}`);
}
