// ============================================
// 📁 src/sync/sync.service.ts
// Orchestration de la synchronisation des emplois du temps
// ============================================

import { fetchDocument } from "./fetcher.js";
import { discoverFiles, isYearFile } from "./listing.js";
import { parseTimetable } from "./pdf/parse.js";
import type { FileSyncResult, SourceFile, SyncStatus, SyncSummary } from "./types.js";

export interface SyncOptions {
    /** Analyse les documents et rapporte, sans rien écrire. */
    dryRun?: boolean;
    /** Ignore les en-têtes de cache et retélécharge tout. */
    force?: boolean;
}

/**
 * Chaîne complète : découverte du listing, téléchargement conditionnel,
 * archivage, lecture des documents et alimentation de la base.
 *
 * Seuls les documents d'**année** alimentent la base. Ceux des groupes et
 * sous-groupes, ainsi que les `.ics`, sont archivés sans être importés : leur
 * contenu s'est révélé faux (attributions de groupe erronées, cours manquants).
 */
export class SyncService {
    public static instance: SyncService = new SyncService();

    private status: SyncStatus = { isRunning: false, lastSync: null };

    getStatus(): SyncStatus {
        return this.status;
    }

    async syncAll(options: SyncOptions = {}): Promise<SyncSummary> {
        if (this.status.isRunning) {
            throw new Error("Une synchronisation est déjà en cours");
        }

        this.status.isRunning = true;
        const startedAt = new Date();

        const results: FileSyncResult[] = [];
        const errors: string[] = [];

        try {
            const files = await discoverFiles();
            const timetables = files.filter((file) => file.format === "pdf" && isYearFile(file));

            console.log(
                `🔍 ${files.length} fichiers publiés, dont ${timetables.length} emplois du temps d'année`,
            );

            for (const file of timetables) {
                try {
                    results.push(await this.syncFile(file, options));
                } catch (error) {
                    const message = `${file.scope} semaine ${file.weekNumber} : ${error}`;
                    console.error(`❌ ${message}`);
                    errors.push(message);
                }
            }

            if (!options.dryRun) {
                await this.archiveOthers(files, options);

                const { Importer } = await import("./importer.js");
                const orphans = await Importer.instance.deleteOrphanLessons();
                if (orphans > 0) console.log(`🧹 ${orphans} cours orphelins supprimés`);
            }

            const summary = this.buildSummary(startedAt, timetables.length, results, errors);
            this.status.lastSync = summary;

            console.log(
                `✅ Sync terminée : ${summary.filesDownloaded} documents traités, ` +
                    `${summary.filesSkipped} inchangés, ${summary.lessonsCreated} cours créés`,
            );

            return summary;
        } finally {
            this.status.isRunning = false;
        }
    }

    /**
     * Traite un emploi du temps d'année.
     */
    private async syncFile(file: SourceFile, options: SyncOptions): Promise<FileSyncResult> {
        if (options.dryRun) return this.inspectFile(file);

        const { Importer } = await import("./importer.js");
        const importer = Importer.instance;
        const source = await importer.getOrCreateSource(file);

        const outcome = await fetchDocument(
            file.url,
            `${file.year}/${file.scope}`,
            file.fileName,
            options.force ? {} : { etag: source.etag, lastModified: source.lastModified },
        );

        if (outcome.status === "unchanged") {
            await importer.touchSource(source.id);
            return this.emptyResult(file, true);
        }

        const timetable = await parseTimetable(outcome.content, file.year);
        const caches = await this.getCaches();
        const imported = await importer.importLessons(caches, source, timetable.lessons, file.year);

        await importer.updateSourceHeaders(source.id, {
            url: file.url,
            etag: outcome.etag,
            lastModified: outcome.lastModified,
            contentHash: outcome.contentHash,
            backupPath: outcome.backupPath,
        });

        console.log(
            `   📥 ${file.scope} S${file.weekNumber} : ${timetable.lessons.length} cours, ` +
                `${imported.lessonsCreated} créés`,
        );

        return {
            file,
            skipped: false,
            lessonsParsed: timetable.lessons.length,
            lessonsCreated: imported.lessonsCreated,
            lessonsLinked: imported.lessonsLinked,
            unreadableCells: timetable.unreadable,
            unknownRooms: timetable.unknownRooms,
        };
    }

    /**
     * Mode lecture seule : télécharge en mémoire, analyse, ne stocke rien.
     */
    private async inspectFile(file: SourceFile): Promise<FileSyncResult> {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const timetable = await parseTimetable(new Uint8Array(await response.arrayBuffer()), file.year);

        return {
            file,
            skipped: false,
            lessonsParsed: timetable.lessons.length,
            lessonsCreated: 0,
            lessonsLinked: 0,
            unreadableCells: timetable.unreadable,
            unknownRooms: timetable.unknownRooms,
        };
    }

    /**
     * Archive les fichiers non importés — documents de groupe et `.ics`.
     *
     * Ils ne sont pas exploités, mais les conserver permet de constater si
     * l'IUT finit par les corriger, et de comprendre après coup un changement
     * d'emploi du temps.
     */
    private async archiveOthers(files: SourceFile[], options: SyncOptions): Promise<void> {
        const others = files.filter((file) => !(file.format === "pdf" && isYearFile(file)));
        const { Importer } = await import("./importer.js");
        const importer = Importer.instance;

        let archived = 0;

        for (const file of others) {
            try {
                const source = await importer.getOrCreateSource(file);
                const outcome = await fetchDocument(
                    file.url,
                    `${file.year}/${file.scope}`,
                    file.fileName,
                    options.force ? {} : { etag: source.etag, lastModified: source.lastModified },
                );

                if (outcome.status === "unchanged") {
                    await importer.touchSource(source.id);
                    continue;
                }

                await importer.updateSourceHeaders(source.id, {
                    url: file.url,
                    etag: outcome.etag,
                    lastModified: outcome.lastModified,
                    contentHash: outcome.contentHash,
                    backupPath: outcome.backupPath,
                });

                archived += 1;
            } catch (error) {
                console.warn(`⚠️  ${file.fileName} non archivé : ${error}`);
            }
        }

        if (archived > 0) console.log(`🗂️  ${archived} fichiers archivés sans import`);
    }

    /** Caches partagés par tous les documents d'un même passage. */
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

    private emptyResult(file: SourceFile, skipped: boolean): FileSyncResult {
        return {
            file,
            skipped,
            lessonsParsed: 0,
            lessonsCreated: 0,
            lessonsLinked: 0,
            unreadableCells: [],
            unknownRooms: [],
        };
    }

    private buildSummary(
        startedAt: Date,
        filesDiscovered: number,
        results: FileSyncResult[],
        errors: string[],
    ): SyncSummary {
        return {
            success: errors.length === 0,
            startedAt,
            completedAt: new Date(),
            filesDiscovered,
            filesDownloaded: results.filter((result) => !result.skipped).length,
            filesSkipped: results.filter((result) => result.skipped).length,
            lessonsCreated: results.reduce((total, result) => total + result.lessonsCreated, 0),
            lessonsLinked: results.reduce((total, result) => total + result.lessonsLinked, 0),
            unreadableCells: [...new Set(results.flatMap((result) => result.unreadableCells))],
            unknownRooms: [...new Set(results.flatMap((result) => result.unknownRooms))],
            errors,
            files: results,
        };
    }
}

export default SyncService.instance;
