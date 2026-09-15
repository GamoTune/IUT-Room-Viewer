// ============================================
// 📁 tests/sync/sync.service.spec.ts
//
// Les dépendances de la chaîne — listing, téléchargement et import — sont
// remplacées : c'est l'enchaînement qui est éprouvé ici, pas leurs
// implémentations, testées chacune de leur côté.
// ============================================

import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { SourceFile } from "../../src/sync/types.js";

const discoverFiles = mock<() => Promise<SourceFile[]>>(async () => []);
const fetchDocument = mock<(...args: unknown[]) => Promise<unknown>>(async () => ({}));

const importer = {
    getOrCreateSource: mock(async () => ({ id: 1, etag: "e1", lastModified: "lm1" })),
    touchSource: mock(async () => undefined),
    importLessons: mock(async (..._args: unknown[]) => ({ lessonsCreated: 0, lessonsLinked: 0 })),
    updateSourceHeaders: mock(async () => undefined),
    deleteOrphanLessons: mock(async () => 0),
};

const loadRooms = mock(async () => undefined);

// `mock.module` remplace le module pour tout le processus, et ni `mock.restore`
// ni un second `mock.module` en `afterAll` ne le défont pour les fichiers
// suivants. Ce fichier ne reste sans effet sur les autres que parce que
// `bun test` est lancé avec `--isolate` (voir package.json et
// scripts/coverage.ts) : un simple `bun test` le fait fuir selon l'ordre des
// fichiers.
//
// `pdf/parse.js` n'est volontairement pas remplacé : la chaîne lit une vraie
// archive, ce qui éprouve au passage le branchement du parseur.
const vraiListing = await import("../../src/sync/listing.js");

mock.module("../../src/sync/listing.js", () => ({ ...vraiListing, discoverFiles }));
mock.module("../../src/sync/fetcher.js", () => ({ fetchDocument }));
mock.module("../../src/sync/importer.js", () => ({
    Importer: { instance: importer },
    ImportCaches: class {
        loadRooms = loadRooms;
    },
}));

const { SyncService } = await import("../../src/sync/sync.service.js");

/** Un fichier du listing. `scope === year` en fait un emploi du temps d'année. */
function fichier(scope: string, year = "A3", format = "pdf", weekNumber = 1): SourceFile {
    return {
        year,
        scope,
        weekNumber,
        format,
        fileName: `${scope}_S${weekNumber}.${format}`,
        url: `https://edt.test/${scope}_S${weekNumber}.${format}`,
    } as SourceFile;
}

/** Archive réelle servie par le téléchargement simulé : 23 cours, aucune anomalie. */
const OCTETS = await Bun.file(new URL("../fixtures/A3_S1.pdf", import.meta.url)).arrayBuffer();
const COURS_DE_LA_FIXTURE = 23;

/**
 * pdfjs prend possession du tampon qu'on lui passe et le détache : le relire
 * une seconde fois lèverait `DataCloneError`. Chaque lecture reçoit donc son
 * propre exemplaire.
 */
const pdfFrais = () => new Uint8Array(OCTETS.slice(0));

const téléchargé = {
    status: "downloaded",
    content: new Uint8Array(),
    etag: "e2",
    lastModified: "lm2",
    contentHash: "h2",
    backupPath: "/tmp/x.pdf",
};


describe("SyncService", () => {
    let service: InstanceType<typeof SyncService>;

    beforeEach(() => {
        for (const m of [discoverFiles, fetchDocument, loadRooms, ...Object.values(importer)]) {
            m.mockClear();
        }

        discoverFiles.mockResolvedValue([]);
        fetchDocument.mockImplementation(async () => ({ ...téléchargé, content: pdfFrais() }));
        importer.getOrCreateSource.mockResolvedValue({ id: 1, etag: "e1", lastModified: "lm1" });
        importer.importLessons.mockResolvedValue({ lessonsCreated: 2, lessonsLinked: 5 });
        importer.deleteOrphanLessons.mockResolvedValue(0);

        spyOn(console, "log").mockImplementation(() => {});
        spyOn(console, "warn").mockImplementation(() => {});
        spyOn(console, "error").mockImplementation(() => {});

        // Une instance neuve par test : l'état de marche est porté par le service.
        service = new SyncService();
    });

    describe("getStatus", () => {
        it("part à l'arrêt, sans dernière synchronisation", () => {
            expect(service.getStatus()).toEqual({ isRunning: false, lastSync: null });
        });

        it("retient le bilan de la dernière synchronisation", async () => {
            await service.syncAll();
            expect(service.getStatus().lastSync).not.toBeNull();
        });
    });

    describe("syncAll", () => {
        it("n'importe que les PDF d'année", async () => {
            discoverFiles.mockResolvedValue([
                fichier("A3"),
                fichier("G8a"),
                fichier("A3", "A3", "ics"),
            ]);

            const bilan = await service.syncAll();

            expect(bilan.filesDiscovered).toBe(1);
            expect(importer.importLessons).toHaveBeenCalledTimes(1);
        });

        it("compte les cours créés et rattachés", async () => {
            discoverFiles.mockResolvedValue([fichier("A3")]);

            const bilan = await service.syncAll();

            expect(bilan.lessonsCreated).toBe(2);
            expect(bilan.lessonsLinked).toBe(5);
            expect(bilan.filesDownloaded).toBe(1);
            expect(bilan.success).toBe(true);
        });

        it("passe un document inchangé sans le relire", async () => {
            discoverFiles.mockResolvedValue([fichier("A3")]);
            fetchDocument.mockImplementation(async () => ({ status: "unchanged" }));

            const bilan = await service.syncAll();

            expect(bilan.filesSkipped).toBe(1);
            expect(importer.touchSource).toHaveBeenCalledWith(1);
            expect(importer.importLessons).not.toHaveBeenCalled();
        });

        it("transmet les en-têtes de cache, sauf en reprise forcée", async () => {
            discoverFiles.mockResolvedValue([fichier("A3")]);

            await service.syncAll();
            expect(fetchDocument.mock.calls[0]![3]).toEqual({ etag: "e1", lastModified: "lm1" });

            fetchDocument.mockClear();
            await service.syncAll();
            await service.syncAll({ force: true });
            expect(fetchDocument.mock.calls.at(-1)![3]).toEqual({});
        });

        it("poursuit malgré l'échec d'un document et le rapporte", async () => {
            discoverFiles.mockResolvedValue([fichier("A3"), fichier("A1", "A1")]);
            importer.importLessons.mockRejectedValueOnce(new Error("import impossible"));

            const bilan = await service.syncAll();

            expect(bilan.success).toBe(false);
            expect(bilan.errors).toHaveLength(1);
            expect(bilan.errors[0]).toContain("import impossible");
            expect(bilan.filesDownloaded).toBe(1);
        });

        it("supprime les cours devenus orphelins", async () => {
            importer.deleteOrphanLessons.mockResolvedValue(3);

            await service.syncAll();

            expect(importer.deleteOrphanLessons).toHaveBeenCalled();
        });

        it("refuse une seconde synchronisation simultanée", async () => {
            discoverFiles.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve([]), 20)),
            );

            const première = service.syncAll();
            expect(service.syncAll()).rejects.toThrow("déjà en cours");
            await première;
        });

        it("se remet à l'arrêt même après un échec", async () => {
            discoverFiles.mockRejectedValue(new Error("listing injoignable"));

            expect(service.syncAll()).rejects.toThrow("listing injoignable");
            await Bun.sleep(1);
            expect(service.getStatus().isRunning).toBe(false);
        });

        it("transmet au traitement les cours lus dans le document", async () => {
            discoverFiles.mockResolvedValue([fichier("A3")]);

            await service.syncAll();

            const cours = importer.importLessons.mock.calls[0]![2] as unknown[];
            expect(cours).toHaveLength(COURS_DE_LA_FIXTURE);
        });

        it("ne signale ni case illisible ni salle inconnue sur un document sain", async () => {
            discoverFiles.mockResolvedValue([fichier("A3"), fichier("A1", "A1")]);

            const bilan = await service.syncAll();

            expect(bilan.unreadableCells).toEqual([]);
            expect(bilan.unknownRooms).toEqual([]);
        });
    });

    describe("mode analyse", () => {
        it("télécharge en mémoire sans rien écrire", async () => {
            discoverFiles.mockResolvedValue([fichier("A3")]);
            spyOn(globalThis, "fetch").mockImplementation((async () => new Response(pdfFrais())) as unknown as typeof fetch);

            const bilan = await service.syncAll({ dryRun: true });

            expect(bilan.lessonsCreated).toBe(0);
            expect(importer.getOrCreateSource).not.toHaveBeenCalled();
            expect(importer.deleteOrphanLessons).not.toHaveBeenCalled();
        });

        it("rapporte l'échec du téléchargement", async () => {
            discoverFiles.mockResolvedValue([fichier("A3")]);
            spyOn(globalThis, "fetch").mockImplementation((async () => new Response("", { status: 404 })) as unknown as typeof fetch);

            const bilan = await service.syncAll({ dryRun: true });

            expect(bilan.success).toBe(false);
            expect(bilan.errors[0]).toContain("HTTP 404");
        });
    });

    describe("archivage des documents non exploités", () => {
        it("ne s'exécute que sur demande", async () => {
            discoverFiles.mockResolvedValue([fichier("G8a")]);

            await service.syncAll();
            expect(fetchDocument).not.toHaveBeenCalled();

            await service.syncAll({ archiveOthers: true });
            expect(fetchDocument).toHaveBeenCalled();
        });

        it("met à jour les en-têtes d'un fichier archivé", async () => {
            discoverFiles.mockResolvedValue([fichier("G8a")]);

            await service.syncAll({ archiveOthers: true });

            expect(importer.updateSourceHeaders).toHaveBeenCalled();
        });

        it("se contente de dater un fichier inchangé", async () => {
            discoverFiles.mockResolvedValue([fichier("G8a")]);
            fetchDocument.mockImplementation(async () => ({ status: "unchanged" }));

            await service.syncAll({ archiveOthers: true });

            expect(importer.touchSource).toHaveBeenCalled();
            expect(importer.updateSourceHeaders).not.toHaveBeenCalled();
        });

        it("poursuit malgré l'échec d'un archivage", async () => {
            discoverFiles.mockResolvedValue([fichier("G8a"), fichier("G8b")]);
            fetchDocument.mockImplementationOnce(async () => { throw new Error("réseau"); });

            const bilan = await service.syncAll({ archiveOthers: true });

            // L'archivage est accessoire : son échec ne compromet pas la synchronisation.
            expect(bilan.success).toBe(true);
        });
    });
});
