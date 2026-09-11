// ============================================
// 📁 scripts/coverage.ts
// Vérification du seuil de couverture
//
//   bun run coverage
//
// Bun accepte `coverageThreshold` dans bunfig.toml mais ne l'applique pas : la
// commande réussit quel que soit le résultat. On relit donc le rapport LCOV
// qu'il produit, et on décide ici.
// ============================================

import config from "../bunfig.toml";

const SEUIL_LIGNES = 90;
const RAPPORT = "coverage/lcov.info";

/**
 * Le rapport texte de Bun honore `coveragePathIgnorePatterns`, mais pas son
 * LCOV : les mêmes exclusions sont donc rejouées ici, depuis la configuration
 * plutôt que recopiées.
 */
const exclusions: string[] = (config as { test?: { coveragePathIgnorePatterns?: string[] } }).test
    ?.coveragePathIgnorePatterns ?? [];

const motifs = exclusions.map((motif) => new Bun.Glob(motif));
const exclu = (chemin: string) => motifs.some((motif) => motif.match(chemin) || motif.match(`/${chemin}`));

const exécution = Bun.spawnSync(["bun", "test"], { stdout: "inherit", stderr: "inherit" });

if (exécution.exitCode !== 0) {
    console.error("\n❌ Des tests échouent : la couverture n'est pas évaluée.");
    process.exit(exécution.exitCode ?? 1);
}

const fichier = Bun.file(RAPPORT);
if (!(await fichier.exists())) {
    console.error(`\n❌ Rapport introuvable : ${RAPPORT}`);
    process.exit(1);
}

let trouvées = 0;
let atteintes = 0;
let courantExclu = false;

for (const ligne of (await fichier.text()).split("\n")) {
    if (ligne.startsWith("SF:")) {
        courantExclu = exclu(ligne.slice(3).trim());
        continue;
    }
    if (courantExclu) continue;

    if (ligne.startsWith("LF:")) trouvées += Number(ligne.slice(3));
    if (ligne.startsWith("LH:")) atteintes += Number(ligne.slice(3));
}

const pourcentage = trouvées === 0 ? 0 : (atteintes / trouvées) * 100;
const verdict = pourcentage >= SEUIL_LIGNES ? "✅" : "❌";

console.log(
    `\n${verdict} Lignes couvertes : ${atteintes}/${trouvées} — ${pourcentage.toFixed(2)} % (seuil ${SEUIL_LIGNES} %)`,
);

// Bun ne mesure pas les branches : son LCOV ne porte aucun enregistrement BRDA.
console.log("ℹ️  Les branches ne sont pas mesurées : `bun test` ne les instrumente pas.");

if (pourcentage < SEUIL_LIGNES) process.exit(1);
