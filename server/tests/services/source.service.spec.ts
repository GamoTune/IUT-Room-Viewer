// ============================================
// 📁 tests/services/source.service.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import groupRepository from "../../src/repository/group.repository.js";
import sourceRepository from "../../src/repository/source.repository.js";
import { SourceService } from "../../src/services/source.service.js";
import type { EdtSource } from "../../src/entities/edtSource.entity.js";
import { studentGroup } from "../helpers/fixtures.js";

/** Un document suivi, réduit à ce que le service consulte. */
const source = (scope: string, format: "pdf" | "ics", weekNumber = 2): EdtSource =>
    ({ scope, format, weekNumber, url: `https://edt.test/${scope}_S${weekNumber}.${format}` }) as EdtSource;

describe("SourceService", () => {
    const findByCode = spyOn(groupRepository, "findByCode");
    const findWeekNumber = spyOn(sourceRepository, "findWeekNumber");
    const findFiles = spyOn(sourceRepository, "findFiles");

    const lundi = new Date("2026-09-06T22:00:00.000Z");

    beforeEach(() => {
        findByCode.mockClear();
        findWeekNumber.mockClear();
        findFiles.mockClear();

        findByCode.mockResolvedValue(studentGroup("G8a", "A3", 8, "a"));
        findWeekNumber.mockResolvedValue(2);
        findFiles.mockResolvedValue([]);
    });

    afterAll(() => {
        findByCode.mockRestore();
        findWeekNumber.mockRestore();
        findFiles.mockRestore();
    });

    describe("getWeekSources", () => {
        it("rend null pour un groupe inconnu", async () => {
            findByCode.mockResolvedValue(null);

            expect(await SourceService.instance.getWeekSources("G99z", lundi)).toBeNull();
            expect(findWeekNumber).not.toHaveBeenCalled();
        });

        it("rend six emplacements, du sous-groupe à l'année, PDF puis ICS", async () => {
            const { files } = (await SourceService.instance.getWeekSources("G8a", lundi))!;

            expect(files.map((f) => `${f.level}:${f.scope}:${f.format}`)).toEqual([
                "subGroup:G8a:pdf",
                "subGroup:G8a:ics",
                "group:G8:pdf",
                "group:G8:ics",
                "year:A3:pdf",
                "year:A3:ics",
            ]);
        });

        it("porte l'adresse des documents publiés et laisse vides les autres", async () => {
            // Ce que l'IUT publie réellement : pas d'ICS pour le groupe ni pour l'année.
            findFiles.mockResolvedValue([source("G8a", "pdf"), source("G8a", "ics"), source("G8", "pdf"), source("A3", "pdf")]);

            const { weekNumber, files } = (await SourceService.instance.getWeekSources("G8a", lundi))!;

            expect(weekNumber).toBe(2);
            expect(files.map((f) => f.url !== null)).toEqual([true, true, true, false, true, false]);
            expect(files[0]!.url).toBe("https://edt.test/G8a_S2.pdf");
        });

        it("cherche la semaine sur les sept jours qui suivent le début donné", async () => {
            await SourceService.instance.getWeekSources("G8a", lundi);

            expect(findWeekNumber).toHaveBeenCalledWith("A3", lundi, new Date("2026-09-13T22:00:00.000Z"));
        });

        it("demande les trois périmètres du groupe", async () => {
            await SourceService.instance.getWeekSources("G8a", lundi);

            expect(findFiles).toHaveBeenCalledWith(2, ["G8a", "G8", "A3"]);
        });

        it("garde ses emplacements, vides, pour une semaine sans document", async () => {
            findWeekNumber.mockResolvedValue(null);

            const résultat = (await SourceService.instance.getWeekSources("G8a", lundi))!;

            expect(résultat.weekNumber).toBeNull();
            expect(résultat.files).toHaveLength(6);
            expect(résultat.files.every((f) => f.url === null)).toBe(true);
            expect(findFiles).not.toHaveBeenCalled();
        });

        it("laisse vide le niveau sous-groupe d'un groupe qui n'en a pas", async () => {
            findByCode.mockResolvedValue(studentGroup("G8", "A3", 8, null));
            findFiles.mockResolvedValue([source("G8", "pdf")]);

            const { files } = (await SourceService.instance.getWeekSources("G8", lundi))!;

            expect(findFiles).toHaveBeenCalledWith(2, ["G8", "A3"]);
            expect(files.filter((f) => f.level === "subGroup").every((f) => f.scope === null && f.url === null)).toBe(true);
            expect(files.find((f) => f.level === "group" && f.format === "pdf")!.url).not.toBeNull();
        });
    });
});
