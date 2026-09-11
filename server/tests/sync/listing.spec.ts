// ============================================
// 📁 tests/sync/listing.spec.ts
// ============================================

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { discoverFiles, extractWeekNumber, isYearFile, parseDirectoryListing } from "../../src/sync/listing.js";
import type { SourceFile } from "../../src/sync/types.js";

describe("parseDirectoryListing", () => {
    it("relève les liens d'un index Apache", () => {
        const html = `<a href="A1/">A1/</a><a href="A2/">A2/</a>`;
        expect(parseDirectoryListing(html)).toEqual(["A1/", "A2/"]);
    });

    it("ignore les liens de tri des colonnes", () => {
        expect(parseDirectoryListing(`<a href="?C=N;O=D">Name</a><a href="A1/">A1/</a>`)).toEqual(["A1/"]);
    });

    it("ignore le lien vers le dossier parent et les chemins absolus", () => {
        const html = `<a href="../">Parent</a><a href="/racine/">Racine</a><a href="A1/">A1/</a>`;
        expect(parseDirectoryListing(html)).toEqual(["A1/"]);
    });

    it("ne retient qu'une fois un lien répété", () => {
        expect(parseDirectoryListing(`<a href="A1/">x</a><a href="A1/">y</a>`)).toEqual(["A1/"]);
    });

    it("accepte une casse d'attribut quelconque", () => {
        expect(parseDirectoryListing(`<a HREF="A1/">A1</a>`)).toEqual(["A1/"]);
    });

    it("rend une liste vide sans lien", () => {
        expect(parseDirectoryListing("<html>rien</html>")).toEqual([]);
    });
});

describe("extractWeekNumber", () => {
    it("lit le numéro de semaine d'un PDF", () => {
        expect(extractWeekNumber("A1_S3.pdf")).toBe(3);
    });

    it("lit le numéro de semaine d'un ICS", () => {
        expect(extractWeekNumber("G8a_S12.ics")).toBe(12);
    });

    it("accepte une extension en majuscules", () => {
        expect(extractWeekNumber("A1_S3.PDF")).toBe(3);
    });

    it("rend null quand le nom ne porte pas de semaine", () => {
        expect(extractWeekNumber("A1.pdf")).toBeNull();
        expect(extractWeekNumber("A1_S3.txt")).toBeNull();
        expect(extractWeekNumber("")).toBeNull();
    });
});

describe("isYearFile", () => {
    const fichier = (scope: string, year: string): SourceFile =>
        ({ year, scope, weekNumber: 1, format: "pdf", fileName: "x.pdf", url: "http://x" }) as SourceFile;

    it("reconnaît un emploi du temps de promotion", () => {
        expect(isYearFile(fichier("A1", "A1"))).toBe(true);
    });

    it("écarte un emploi du temps de groupe", () => {
        expect(isYearFile(fichier("G8a", "A3"))).toBe(false);
    });
});

describe("discoverFiles", () => {
    const RACINE = "https://edt.test/edt/";

    /** Index Apache minimal, réduit aux liens. */
    const index = (...entrées: string[]) => entrées.map((e) => `<a href="${e}">${e}</a>`).join("");

    /** Sert un listing par URL ; toute URL absente renvoie un 404. */
    function servir(pages: Record<string, string>): void {
        spyOn(globalThis, "fetch").mockImplementation((async (input: RequestInfo | URL) => {
            const url = String(input);
            const corps = pages[url];
            if (corps === undefined) return new Response("absent", { status: 404 });
            return new Response(corps, { status: 200 });
        }) as typeof fetch);
    }

    afterEach(() => {
        mock.restore();
    });

    it("parcourt les années, puis leurs groupes", async () => {
        servir({
            [RACINE]: index("A1/", "A3/"),
            [`${RACINE}A1/`]: index("A1_S1.pdf"),
            [`${RACINE}A3/`]: index("A3_S1.pdf", "G8a/"),
            [`${RACINE}A3/G8a/`]: index("G8a_S1.ics"),
        });

        const fichiers = await discoverFiles(RACINE);

        expect(fichiers.map((f) => [f.year, f.scope, f.format])).toEqual([
            ["A1", "A1", "pdf"],
            ["A3", "A3", "pdf"],
            ["A3", "G8a", "ics"],
        ]);
        expect(fichiers[0]!.url).toBe(`${RACINE}A1/A1_S1.pdf`);
    });

    it("ignore les dossiers qui ne sont pas des années", async () => {
        servir({
            [RACINE]: index("A1/", "archives/", "lisezmoi.txt"),
            [`${RACINE}A1/`]: index("A1_S1.pdf"),
        });

        const fichiers = await discoverFiles(RACINE);
        expect(fichiers.map((f) => f.scope)).toEqual(["A1"]);
    });

    it("écarte un fichier dont la semaine est illisible", async () => {
        const warn = spyOn(console, "warn").mockImplementation(() => {});
        servir({
            [RACINE]: index("A1/"),
            [`${RACINE}A1/`]: index("A1.pdf", "A1_S2.pdf"),
        });

        const fichiers = await discoverFiles(RACINE);
        expect(fichiers.map((f) => f.weekNumber)).toEqual([2]);
        expect(warn).toHaveBeenCalled();
    });

    it("écarte un fichier de groupe dont la semaine est illisible", async () => {
        spyOn(console, "warn").mockImplementation(() => {});
        servir({
            [RACINE]: index("A3/"),
            [`${RACINE}A3/`]: index("G8a/"),
            [`${RACINE}A3/G8a/`]: index("G8a.pdf", "notes.txt"),
        });

        expect(await discoverFiles(RACINE)).toEqual([]);
    });

    it("trie par année, semaine, périmètre puis format", async () => {
        servir({
            [RACINE]: index("A3/", "A1/"),
            [`${RACINE}A1/`]: index("A1_S2.pdf", "A1_S1.pdf"),
            [`${RACINE}A3/`]: index("A3_S1.ics", "A3_S1.pdf"),
        });

        const fichiers = await discoverFiles(RACINE);
        expect(fichiers.map((f) => `${f.year}-S${f.weekNumber}-${f.format}`)).toEqual([
            "A1-S1-pdf",
            "A1-S2-pdf",
            "A3-S1-ics",
            "A3-S1-pdf",
        ]);
    });

    it("accepte une racine sans barre finale", async () => {
        servir({
            "https://edt.test/edt/": index("A1/"),
            "https://edt.test/edt/A1/": index("A1_S1.pdf"),
        });

        // La racine sans barre est demandée telle quelle, puis les segments sont
        // joints avec une barre : seule la première requête diffère.
        spyOn(globalThis, "fetch").mockImplementation((async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === "https://edt.test/edt") return new Response(index("A1/"), { status: 200 });
            if (url === "https://edt.test/edt/A1/") return new Response(index("A1_S1.pdf"), { status: 200 });
            return new Response("absent", { status: 404 });
        }) as typeof fetch);

        const fichiers = await discoverFiles("https://edt.test/edt");
        expect(fichiers).toHaveLength(1);
    });

    it("remonte l'échec d'un listing plutôt que de rendre une liste partielle", async () => {
        servir({});
        expect(discoverFiles(RACINE)).rejects.toThrow("HTTP 404");
    });
});
