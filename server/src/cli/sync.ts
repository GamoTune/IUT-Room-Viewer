// ============================================
// 📁 src/cli/sync.ts
// Lancement manuel d'une synchronisation
//
//   bun run sync              synchronisation complète
//   bun run sync --dry-run    analyse seule, aucune écriture
//   bun run sync --force      ignore les en-têtes de cache
// ============================================

import "dotenv/config";
import { IcsSyncService } from "../sync/ics/ics-sync.service.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");

async function main() {
    if (dryRun) {
        console.log("🔍 Analyse seule : aucune écriture en base ni sur disque\n");
    }

    const summary = await IcsSyncService.instance.syncAll({
        dryRun,
        force,
        backupPdfs: !dryRun,
    });

    if (dryRun) {
        console.log("\n──────── Détail par fichier ────────");
        for (const file of summary.files) {
            console.log(
                `${file.file.year}/${file.file.groupCode} S${file.file.weekNumber}`.padEnd(16) +
                    `${String(file.eventsParsed).padStart(3)} événements` +
                    `   ${String(file.lessonsCreated).padStart(3)} inédits`,
            );
        }
    }

    console.log("\n──────── Bilan ────────");
    console.log(`Fichiers publiés      : ${summary.filesDiscovered}`);
    console.log(`Traités               : ${summary.filesDownloaded}`);
    console.log(`Inchangés (304)       : ${summary.filesSkipped}`);
    console.log(`Cours distincts       : ${summary.lessonsCreated}`);
    console.log(`Rattachements groupes : ${summary.lessonsLinked}`);
    console.log(
        `Doublons évités       : ${summary.lessonsLinked - summary.lessonsCreated}` +
            " (cours communs publiés dans plusieurs groupes)",
    );

    if (summary.unknownRooms.length > 0) {
        console.log(`\n⚠️  Salles hors référentiel : ${summary.unknownRooms.join(", ")}`);
        console.log("   (à ajouter dans src/sync/ics/rooms.reference.ts si elles sont légitimes)");
    }

    if (summary.unparsedSummaries.length > 0) {
        console.log(`\n⚠️  Intitulés non reconnus (${summary.unparsedSummaries.length}) :`);
        for (const summaryText of summary.unparsedSummaries) console.log(`   - ${summaryText}`);
    }

    if (summary.errors.length > 0) {
        console.log(`\n❌ Erreurs (${summary.errors.length}) :`);
        for (const error of summary.errors) console.log(`   - ${error}`);
    }

    if (!dryRun) {
        const { closeDatabase } = await import("../db/client.js");
        await closeDatabase();
    }

    process.exit(summary.success ? 0 : 1);
}

main().catch((error) => {
    console.error("❌ Synchronisation interrompue :", error);
    process.exit(1);
});
