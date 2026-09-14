// ============================================
// 📁 tests/sync/ics/normalize.spec.ts
// ============================================

import { describe, expect, it } from "bun:test";
import { parseSummary } from "../../../src/sync/ics/normalize.js";

describe("parseSummary", () => {
    it("décompose un intitulé complet", () => {
        expect(parseSummary("R1.10 R1.10 R1.10 - Anglais technique JP TD")).toEqual({
            subjectCode: "R1.10",
            subjectLabel: "Anglais technique",
            teacherInitials: "JP",
            type: "TD",
            degraded: false,
        });
    });

    it("accepte un code d'intitulé différent du code de tête", () => {
        const parts = parseSummary("S3.01A S3.01A S3.01 - Developpement logiciel LD Cours");
        expect(parts.subjectCode).toBe("S3.01A");
        expect(parts.subjectLabel).toBe("Developpement logiciel");
        expect(parts.type).toBe("CM");
    });

    it("traduit les libellés de type connus", () => {
        expect(parseSummary("X X X - I P Cours").type).toBe("CM");
        expect(parseSummary("X X X - I P CM").type).toBe("CM");
        expect(parseSummary("X X X - I P td").type).toBe("TD");
        expect(parseSummary("X X X - I P TP").type).toBe("TP");
    });

    it("range un libellé de type inconnu dans OTHER", () => {
        expect(parseSummary("X X X - I P Soutenance").type).toBe("OTHER");
    });

    it("retire le point qui tient lieu d'enseignant", () => {
        expect(parseSummary("SCO SCO ACCUEIL/Rentree . Cours").teacherInitials).toBeNull();
    });

    it("isole l'intitulé sans tiret en retirant les répétitions du code", () => {
        const parts = parseSummary("SCO SCO ACCUEIL/Rentree . Cours");
        expect(parts.subjectLabel).toBe("ACCUEIL/Rentree");
    });

    it("ne garde qu'une occurrence d'un code entièrement répété", () => {
        expect(parseSummary("FERIE FERIE FERIE . Cours").subjectLabel).toBe("FERIE");
    });

    it("retombe sur le code quand il ne reste rien d'autre", () => {
        // Trois jetons : code, enseignant, type — le milieu est vide.
        expect(parseSummary("FERIE . Cours").subjectLabel).toBe("FERIE");
    });

    it("garde ce qui reste quand le tiret ne sépare rien", () => {
        // Forme jamais rencontrée en pratique : le tiret final n'est pas un
        // séparateur (` - ` exige un texte après), il finit donc dans l'intitulé.
        expect(parseSummary("R1.10 R1.10 - JP TD").subjectLabel).toBe("-");
    });

    it("coupe au premier séparateur et garde les tirets suivants", () => {
        expect(parseSummary("R1.10 R1.10 - Anglais - renforcé JP TD").subjectLabel).toBe("Anglais - renforcé");
    });

    it("signale un intitulé trop court sans le jeter", () => {
        // L'occupation de la salle doit rester comptabilisée.
        expect(parseSummary("R1.10 TD")).toEqual({
            subjectCode: "R1.10",
            subjectLabel: "R1.10 TD",
            teacherInitials: null,
            type: "OTHER",
            degraded: true,
        });
    });

    it("survit à un intitulé vide", () => {
        expect(parseSummary("   ")).toEqual({
            subjectCode: "INCONNU",
            subjectLabel: "INCONNU",
            teacherInitials: null,
            type: "OTHER",
            degraded: true,
        });
    });

    it("ramène les espaces multiples à un seul", () => {
        expect(parseSummary("R1.10   R1.10   - Anglais   JP   TD").subjectLabel).toBe("Anglais");
    });
});
