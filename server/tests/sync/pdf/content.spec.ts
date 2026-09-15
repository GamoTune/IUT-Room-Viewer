// ============================================
// 📁 tests/sync/pdf/content.spec.ts
// ============================================

import { describe, expect, it } from "bun:test";
import { isSaeCode, readCell } from "../../../src/sync/pdf/content.js";

describe("isSaeCode", () => {
    it("reconnaît une SAÉ à son préfixe", () => {
        expect(isSaeCode("S5A.01")).toBe(true);
    });

    it("écarte une ressource", () => {
        // Les codes en `P` sont des ressources comme ceux en `R`.
        expect(isSaeCode("R5A.04")).toBe(false);
        expect(isSaeCode("P1.02")).toBe(false);
    });

    it("écarte une mention administrative commençant par S", () => {
        // `SCO` est la scolarité, pas une SAÉ : le chiffre fait la différence.
        expect(isSaeCode("SCO")).toBe(false);
        expect(isSaeCode("STAGE")).toBe(false);
    });

    it("accepte les deux formes de code de SAÉ", () => {
        expect(isSaeCode("S5A.01")).toBe(true);
        expect(isSaeCode("S3.St")).toBe(true);
    });
});

describe("readCell — forme compacte", () => {
    it("lit `CODE - ENSEIGNANT - SALLE`", () => {
        expect(readCell(["R5A.06 - SM - 111"])).toEqual({
            subjectCode: "R5A.06",
            subjectLabel: "R5A.06",
            type: "OTHER",
            teacherName: "SM",
            roomNames: ["111"],
            unknownRooms: [],
            raw: "R5A.06 - SM - 111",
            degraded: false,
        });
    });

    it("développe une paire de salles abrégée", () => {
        expect(readCell(["S5A.02 - G7 - 111-2"]).roomNames).toEqual(["111", "112"]);
    });

    it("accepte un nom de groupe à la place de l'enseignant", () => {
        expect(readCell(["S5A.02 - G7 - 111"]).teacherName).toBe("G7");
    });

    it("traduit un point en absence d'enseignant", () => {
        expect(readCell(["R5A.06 - . - 111"]).teacherName).toBeNull();
    });

    it("accepte un code de SAÉ comme de ressource", () => {
        expect(readCell(["S3.St - AP - 111"]).subjectCode).toBe("S3.St");
    });

    it("accepte un code de portfolio", () => {
        // Sans le `P`, la case tombait en mode dégradé et le cours n'était pas importé.
        const lu = readCell(["P5A.01 - AP - 103"]);
        expect(lu.degraded).toBe(false);
        expect(lu.subjectCode).toBe("P5A.01");
        expect(lu.teacherName).toBe("AP");
        expect(lu.roomNames).toEqual(["103"]);
    });

    it("bascule en forme détaillée si le code n'en est pas un", () => {
        // Trois segments mais un code non conforme : ce n'est pas la forme compacte.
        const lu = readCell(["Réunion - SM - 111"]);
        expect(lu.subjectCode).not.toBe("Réunion - SM - 111");
    });

    it("bascule en forme détaillée si le compte de segments diffère", () => {
        expect(readCell(["R5A.06 - SM"]).subjectLabel).not.toBe("R5A.06");
    });
});

describe("readCell — forme détaillée", () => {
    it("lit un cours de promotion sur plusieurs lignes", () => {
        const lu = readCell(["R1.01 R1.01 - Initiation au", "développement", "Cours", "Onete C.", "AC"]);

        expect(lu.subjectCode).toBe("R1.01");
        expect(lu.subjectLabel).toBe("Initiation au développement");
        expect(lu.type).toBe("CM");
        expect(lu.teacherName).toBe("Onete C.");
        expect(lu.roomNames).toEqual(["AmphC"]);
        expect(lu.degraded).toBe(false);
    });

    it("lit la salle accolée au type", () => {
        const lu = readCell(["R3.08 - Probabilités", "TP 105", "TB"]);
        expect(lu.type).toBe("TP");
        expect(lu.roomNames).toEqual(["105"]);
        expect(lu.teacherName).toBe("TB");
    });

    it("retire les répétitions du code faute de tiret", () => {
        expect(readCell(["R1.01 R1.01", "TD", "JP", "103"]).subjectLabel).toBe("R1.01");
    });

    it("garde le titre quand il ne porte pas de code", () => {
        const lu = readCell(["Réunion pédagogique", "TD", "JP", "103"]);
        expect(lu.subjectCode).toBe("RÉUNION");
        expect(lu.subjectLabel).toBe("Réunion pédagogique");
    });

    it("tronque un code de repli trop long", () => {
        const lu = readCell(["MentionAdministrativeInterminable", "TD", "JP", "103"]);
        expect(lu.subjectCode).toHaveLength(20);
    });

    it("range en OTHER une case sans type écrit", () => {
        // Sans mot de type, les deux dernières lignes portent salle et enseignant.
        const lu = readCell(["R5A.14 - Anglais", "JP", "R52"]);
        expect(lu.type).toBe("OTHER");
        expect(lu.roomNames).toEqual(["R52"]);
        expect(lu.teacherName).toBe("JP");
    });

    it("rend un enseignant nul quand un point en tient lieu", () => {
        expect(readCell(["R1.01 - Initiation", "TD", ".", "103"]).teacherName).toBeNull();
    });

    it("rend une salle vide quand aucune n'est reconnue", () => {
        const lu = readCell(["R1.01 - Initiation", "TD", "JP", "Z99"]);
        expect(lu.roomNames).toEqual([]);
    });

    it("signale une case sans code ni intitulé", () => {
        const lu = readCell(["", "TD", "103"]);
        expect(lu.degraded).toBe(true);
    });

    it("signale une case vide sans la jeter", () => {
        expect(readCell([])).toEqual({
            subjectCode: "INCONNU",
            subjectLabel: "",
            type: "OTHER",
            teacherName: null,
            roomNames: [],
            unknownRooms: [],
            raw: "",
            degraded: true,
        });
    });

    it("écarte les lignes vides et normalise les espaces", () => {
        const lu = readCell(["  R1.01   -   Initiation  ", "   ", "TD", "JP", "103"]);
        expect(lu.subjectLabel).toBe("Initiation");
        expect(lu.raw).toBe("R1.01 - Initiation / TD / JP / 103");
    });

    it("retombe sur le code quand l'intitulé ne contient que lui", () => {
        expect(readCell(["R1.01", "TD", "JP", "103"]).subjectLabel).toBe("R1.01");
    });

    it("signale une salle hors référentiel", () => {
        expect(readCell(["R1.01 - Initiation", "TD", "JP", "Z99"]).unknownRooms).toEqual([]);
    });
});
