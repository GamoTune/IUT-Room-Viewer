// ============================================
// 📁 tests/sync/time.spec.ts
// ============================================

import { describe, expect, it } from "bun:test";
import { addDays, parisToUtc } from "../../src/sync/time.js";

describe("parisToUtc", () => {
    /** Une date sans heure, telle que la produit la lecture d'un en-tête de PDF. */
    const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

    it("retranche deux heures en été", () => {
        // 8:00 à Paris le 10 septembre = 6:00 UTC (UTC+2)
        expect(parisToUtc(day("2026-09-10"), 8 * 60).toISOString()).toBe("2026-09-10T06:00:00.000Z");
    });

    it("retranche une heure en hiver", () => {
        // 8:00 à Paris le 10 décembre = 7:00 UTC (UTC+1)
        expect(parisToUtc(day("2026-12-10"), 8 * 60).toISOString()).toBe("2026-12-10T07:00:00.000Z");
    });

    it("tient le jour du passage à l'heure d'hiver", () => {
        // Le 25 octobre 2026, le changement a lieu à 3:00 locales. Un cours de
        // 8:00 est déjà en UTC+1 : c'est la deuxième passe qui le rattrape.
        expect(parisToUtc(day("2026-10-25"), 8 * 60).toISOString()).toBe("2026-10-25T07:00:00.000Z");
    });

    it("tient le jour du passage à l'heure d'été", () => {
        expect(parisToUtc(day("2026-03-29"), 8 * 60).toISOString()).toBe("2026-03-29T06:00:00.000Z");
    });

    it("accepte une heure au-delà de minuit", () => {
        // 25 h depuis minuit, c'est 1:00 le lendemain à Paris — soit 23:00 UTC
        // le jour même, le décalage d'été ramenant l'instant en deçà de minuit.
        expect(parisToUtc(day("2026-09-10"), 25 * 60).toISOString()).toBe("2026-09-10T23:00:00.000Z");
    });

    it("place minuit au bon instant", () => {
        expect(parisToUtc(day("2026-09-10"), 0).toISOString()).toBe("2026-09-09T22:00:00.000Z");
    });
});

describe("addDays", () => {
    it("avance d'un jour", () => {
        expect(addDays(new Date("2026-09-10T08:30:00.000Z"), 1).toISOString()).toBe("2026-09-11T08:30:00.000Z");
    });

    it("recule d'un jour", () => {
        expect(addDays(new Date("2026-09-10T08:30:00.000Z"), -1).toISOString()).toBe("2026-09-09T08:30:00.000Z");
    });

    it("franchit une fin de mois", () => {
        expect(addDays(new Date("2026-09-30T00:00:00.000Z"), 1).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    });

    it("ne modifie pas la date reçue", () => {
        const origine = new Date("2026-09-10T08:30:00.000Z");
        addDays(origine, 5);
        expect(origine.toISOString()).toBe("2026-09-10T08:30:00.000Z");
    });
});
