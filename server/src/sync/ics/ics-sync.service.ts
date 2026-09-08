// ============================================
// 📁 src/sync/ics/ics-sync.service.ts
// Orchestration de la synchronisation des EDT
// ============================================

import { backupPdf, fetchIcs, loadManifest, saveManifest } from "./fetcher.js";
import { discoverFiles } from "./listing.js";
import { computeDedupKey, toParsedLesson } from "./normalize.js";
import { parseIcs } from "./parser.js";
import type { FileSyncResult, IcsFileEntry, ParsedLesson, SyncStatus, SyncSummary } from "./types.js";

export interface SyncOptions {
    /** Analyse les fichiers et rapporte, sans écrire ni en base ni sur disque. */
    dryRun?: boolean;
    /** Archive aussi les PDF (groupes entiers et promos), non exploités par la sync. */
    backupPdfs?: boolean;
    /** Ignore les en-têtes de cache et retélécharge tout. */
    force?: boolean;
}

/**
 * Chaîne complète : découverte du listing, téléchargement conditionnel,
 * archivage, lecture des ICS et alimentation de la base.
 */
export class IcsSyncService {
    public static instance: IcsSyncService = new IcsSyncService();

    private status: SyncStatus = { isRunning: false, lastSync: null };

    /** Empreintes rencontrées pendant une analyse à blanc. */
    private dryRunKeys = new Set<string>();

    getStatus(): SyncStatus {
        return this.status;
    }

    async syncAll(options: SyncOptions = {}): Promise<SyncSummary> {
        if (this.status.isRunning) {
            throw new Error("Une synchronisation est déjà en cours");
        }

        this.status.isRunning = true;
        this.cachesPromise = null;
        this.dryRunKeys.clear();
        const startedAt = new Date();

        const results: FileSyncResult[] = [];
        const errors: string[] = [];

        try {
            const { icsFiles, pdfFiles } = await discoverFiles();
            console.log(
                `🔍 ${icsFiles.length} fichiers ICS et ${pdfFiles.length} PDF publiés`,
            );

            for (const file of icsFiles) {
                try {
                    results.push(
                        options.dryRun
                            ? await this.inspectFile(file)
                            : await this.syncFile(file, options),
                    );
                } catch (error) {
                    const message = `${file.year}/${file.groupCode} semaine ${file.weekNumber} : ${error}`;
                    console.error(`❌ ${message}`);
                    errors.push(message);
                }
            }

            if (!options.dryRun) {
                const { deleteOrphanLessons } = await import("./importer.js");
                const orphans = await deleteOrphanLessons();
                if (orphans > 0) console.log(`🧹 ${orphans} cours orphelins supprimés`);

                if (options.backupPdfs) {
                    await this.backupPdfs(pdfFiles, options.force ?? false);
                }
            }

            const summary = this.buildSummary(startedAt, icsFiles.length, results, errors);
            this.status.lastSync = summary;

            console.log(
                `✅ Sync terminée : ${summary.filesDownloaded} fichiers traités, ` +
                    `${summary.filesSkipped} inchangés, ${summary.lessonsCreated} cours créés, ` +
                    `${summary.lessonsLinked} rattachements`,
            );

            return summary;
        } finally {
            this.status.isRunning = false;
        }
    }

    /**
     * Mode lecture seule : télécharge en mémoire, analyse, ne stocke rien.
     */
    private async inspectFile(file: IcsFileEntry): Promise<FileSyncResult> {
        const response = await fetch(file.url, { headers: { Accept: "text/calendar" } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const lessons = parseIcs(await response.text()).map(toParsedLesson);

        // Sans base, le dédoublonnage se mesure sur les empreintes : un cours
        // déjà vu dans le fichier d'un autre groupe ne serait pas recréé.
        let created = 0;
        for (const parsed of lessons) {
            const key = computeDedupKey(parsed);
            if (!this.dryRunKeys.has(key)) {
                this.dryRunKeys.add(key);
                created += 1;
            }
        }

        return this.describe(file, lessons, {
            skipped: false,
            lessonsCreated: created,
            lessonsLinked: lessons.length,
        });
    }

    private async syncFile(file: IcsFileEntry, options: SyncOptions): Promise<FileSyncResult> {
        const importer = await import("./importer.js");
        const source = await importer.getOrCreateSource(file);

        const outcome = await fetchIcs(
            file.url,
            `${file.year}/${file.groupCode}`,
            file.fileName,
            options.force ? {} : { etag: source.etag, lastModified: source.lastModified },
        );

        if (outcome.status === "unchanged") {
            await importer.touchSource(source.id);
            return this.describe(file, [], { skipped: true, lessonsCreated: 0, lessonsLinked: 0 });
        }

        const lessons = parseIcs(outcome.content).map(toParsedLesson);

        const caches = await this.getCaches();
        const groupId = await importer.upsertStudentGroup(caches, file);
        const imported = await importer.importLessons(caches, file, source.id, groupId, lessons);

        await importer.updateSourceHeaders(source.id, {
            url: file.url,
            etag: outcome.etag,
            lastModified: outcome.lastModified,
            contentHash: outcome.contentHash,
            backupPath: outcome.backupPath,
        });

        console.log(
            `   📥 ${file.year}/${file.groupCode} S${file.weekNumber} : ` +
                `${lessons.length} événements, ${imported.lessonsCreated} cours créés`,
        );

        return this.describe(file, lessons, { skipped: false, ...imported });
    }

    /**
     * Caches partagés par tous les fichiers d'un même passage.
     */
    private cachesPromise: Promise<import("./importer.js").ImportCaches> | null = null;

    private async getCaches(): Promise<import("./importer.js").ImportCaches> {
        if (!this.cachesPromise) {
            this.cachesPromise = (async () => {
                const { ImportCaches } = await import("./importer.js");
                const caches = new ImportCaches();
                await caches.loadRooms();
                return caches;
            })();
        }
        return this.cachesPromise;
    }

    private async backupPdfs(
        pdfFiles: Awaited<ReturnType<typeof discoverFiles>>["pdfFiles"],
        force: boolean,
    ): Promise<void> {
        const manifest = await loadManifest();
        let archived = 0;

        for (const pdf of pdfFiles) {
            try {
                const previous = force ? {} : (manifest[pdf.url] ?? {});
                const result = await backupPdf(
                    pdf.url,
                    `${pdf.year}/${pdf.scope}`,
                    pdf.fileName,
                    previous,
                );

                manifest[pdf.url] = { etag: result.etag, lastModified: result.lastModified };
                if (result.archived) archived += 1;
            } catch (error) {
                console.warn(`⚠️  PDF ${pdf.fileName} non archivé : ${error}`);
            }
        }

        await saveManifest(manifest);
        if (archived > 0) console.log(`🗂️  ${archived} PDF archivés`);
    }

    private describe(
        file: IcsFileEntry,
        lessons: ParsedLesson[],
        outcome: { skipped: boolean; lessonsCreated: number; lessonsLinked: number },
    ): FileSyncResult {
        const unparsedSummaries: string[] = [];
        const unknownRooms: string[] = [];

        for (const parsed of lessons) {
            // Un cours sans salle reconnue alors que l'ICS en cite une : à investiguer.
            for (const unknown of parsed.unknownRooms) {
                if (!unknownRooms.includes(unknown)) unknownRooms.push(unknown);
            }
            if (parsed.degraded && !unparsedSummaries.includes(parsed.rawSummary)) {
                unparsedSummaries.push(parsed.rawSummary);
            }
        }

        return {
            file,
            skipped: outcome.skipped,
            eventsParsed: lessons.length,
            lessonsCreated: outcome.lessonsCreated,
            lessonsLinked: outcome.lessonsLinked,
            unparsedSummaries,
            unknownRooms,
        };
    }

    private buildSummary(
        startedAt: Date,
        filesDiscovered: number,
        results: FileSyncResult[],
        errors: string[],
    ): SyncSummary {
        const unparsedSummaries = [...new Set(results.flatMap((result) => result.unparsedSummaries))];
        const unknownRooms = [...new Set(results.flatMap((result) => result.unknownRooms))];

        return {
            success: errors.length === 0,
            startedAt,
            completedAt: new Date(),
            filesDiscovered,
            filesDownloaded: results.filter((result) => !result.skipped).length,
            filesSkipped: results.filter((result) => result.skipped).length,
            lessonsCreated: results.reduce((total, result) => total + result.lessonsCreated, 0),
            lessonsLinked: results.reduce((total, result) => total + result.lessonsLinked, 0),
            unparsedSummaries,
            unknownRooms,
            errors,
            files: results,
        };
    }
}
