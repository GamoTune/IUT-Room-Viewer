// ============================================
// 📁 tests/sync/pdf/parse.spec.ts
//
// Lecture d'un emploi du temps réel, de bout en bout : géométrie, grille,
// cases et interprétation. La fixture est une archive du document A3 de la
// semaine 1, telle que l'IUT l'a publiée.
// ============================================

import { beforeAll, describe, expect, it } from "bun:test";
import { parseTimetable, type ParsedTimetable } from "../../../src/sync/pdf/parse.js";

describe("parseTimetable", () => {
    let edt: ParsedTimetable;

    beforeAll(async () => {
        const fichier = Bun.file(new URL("../../fixtures/A3_S1.pdf", import.meta.url));
        edt = await parseTimetable(new Uint8Array(await fichier.arrayBuffer()), "A3");
    });

    it("lit la semaine annoncée par l'en-tête", () => {
        expect(edt.header?.monday.toISOString()).toBe("2026-08-31T00:00:00.000Z");
    });

    it("cale l'échelle horaire à moins d'une minute près", () => {
        // La régression sur les libellés d'heures doit rester très serrée :
        // au-delà, les cours glisseraient d'une tranche.
        expect(edt.calibrationError).toBeLessThan(1);
    });

    it("lit toutes les cases sans en abandonner", () => {
        expect(edt.unreadable).toEqual([]);
    });

    it("ne rencontre aucune salle hors référentiel", () => {
        expect(edt.unknownRooms).toEqual([]);
    });

    it("retrouve le nombre de cours de la semaine", () => {
        expect(edt.lessons).toHaveLength(23);
    });

    it("place les cours sur des tranches d'un quart d'heure", () => {
        for (const cours of edt.lessons) {
            expect(cours.start.getUTCMinutes() % 15).toBe(0);
            expect(cours.end.getTime()).toBeGreaterThan(cours.start.getTime());
        }
    });

    it("ne retient que des jours ouvrés", () => {
        for (const cours of edt.lessons) {
            const jour = cours.start.getUTCDay();
            expect(jour).toBeGreaterThan(0);
            expect(jour).toBeLessThan(7);
        }
    });

    it("rattache chaque cours à au moins un sous-groupe", () => {
        for (const cours of edt.lessons) {
            expect(cours.groupCodes.length).toBeGreaterThan(0);
        }
    });

    it("déduit un cours de promotion des quatre sous-groupes qu'il couvre", () => {
        const cm = edt.lessons.find((l) => l.subjectCode === "R5A.07");

        expect(cm?.type).toBe("CM");
        expect(cm?.groupCodes.sort()).toEqual(["G7a", "G7b", "G8a", "G8b"]);
        expect(cm?.roomNames).toEqual(["R47"]);
        expect(cm?.teacherName).toBe("Poursat A.");
    });

    it("range la scolarité hors des SAÉ", () => {
        // `SCO` commence par un S sans être une SAÉ.
        expect(edt.lessons.find((l) => l.subjectCode === "SCO")?.type).not.toBe("SAE");
    });

    it("date les cours en heure de Paris", () => {
        // Le premier cours du mardi commence à 8:00 locales, soit 6:00 UTC en été.
        const mardi = edt.lessons
            .filter((l) => l.start.getUTCDay() === 2)
            .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

        expect(mardi?.start.toISOString()).toBe("2026-09-01T06:00:00.000Z");
    });

    it("conserve le contenu brut de chaque case", () => {
        for (const cours of edt.lessons) {
            expect(cours.rawContent.length).toBeGreaterThan(0);
            expect(cours.degraded).toBe(false);
        }
    });
});
