// ============================================
// 📁 src/cli/sync.ts
// Lancement manuel d'une synchronisation
//
//   bun run sync              synchronisation complète
//   bun run sync --dry-run    analyse seule, aucune écriture
//   bun run sync --force      ignore les en-têtes de cache
//   bun run sync --archive    archive aussi les fichiers non exploités
// ============================================

import "dotenv/config";
import syncService from "../sync/sync.service.js";
import { closeDatabase, initializeDatabase } from "../utils/dataSource.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const archiveOthers = args.has("--archive");

async function main(): Promise<void> {
    if (dryRun) {
        console.log("🔍 Analyse seule : aucune écriture en base ni sur disque\n");
    } else {
        await initializeDatabase();
    }

    const summary = await syncService.syncAll({ dryRun, force, archiveOthers });

    if (dryRun) {
        console.log("\n──────── Détail par document ────────");
        for (const file of summary.files) {
            console.log(
                `${file.file.scope} S${file.file.weekNumber}`.padEnd(12) +
                    `${String(file.lessonsParsed).padStart(3)} cours`,
            );
        }
    }

    console.log("\n──────── Bilan ────────");
    console.log(`Documents d'année     : ${summary.filesDiscovered}`);
    console.log(`Traités               : ${summary.filesDownloaded}`);
    console.log(`Inchangés (304)       : ${summary.filesSkipped}`);
    console.log(`Cours créés           : ${summary.lessonsCreated}`);
    console.log(`Rattachements groupes : ${summary.lessonsLinked}`);

    if (summary.unknownRooms.length > 0) {
        console.log(`\n⚠️  Salles hors référentiel : ${summary.unknownRooms.join(", ")}`);
        console.log("   (à ajouter dans src/sync/rooms.reference.ts si elles sont légitimes)");
    }

    if (summary.unreadableCells.length > 0) {
        console.log(`\n⚠️  Cases non interprétées (${summary.unreadableCells.length}) :`);
        for (const cell of summary.unreadableCells) console.log(`   - ${cell}`);
    }

    if (summary.errors.length > 0) {
        console.log(`\n❌ Erreurs (${summary.errors.length}) :`);
        for (const error of summary.errors) console.log(`   - ${error}`);
    }

    if (!dryRun) await closeDatabase();
    process.exit(summary.success ? 0 : 1);
}

main().catch(async (error) => {
    console.error("❌ Synchronisation interrompue :", error);
    await closeDatabase();
    process.exit(1);
});
