// ============================================
// 📁 tests/sync/subjects.reference.spec.ts
// ============================================

import { describe, expect, it } from "bun:test";
import { officialSubjectLabel } from "../../src/sync/subjects.reference.js";

describe("officialSubjectLabel", () => {
    it("rend l'intitulé d'une ressource du tronc commun", () => {
        expect(officialSubjectLabel("R1.01")).toBe("Initiation au développement");
        expect(officialSubjectLabel("R5.03")).toBe("Politique de communication");
    });

    it("rend l'intitulé d'une ressource du parcours A", () => {
        // `R5.Real.10` dans le programme, `R5A.10` dans les emplois du temps.
        expect(officialSubjectLabel("R5A.10")).toBe("Nouveaux paradigmes de base de données");
    });

    it("rend l'intitulé d'une SAÉ", () => {
        expect(officialSubjectLabel("S1.06")).toBe("Découverte de l’environnement économique et écologique");
        expect(officialSubjectLabel("S5A.01")).toBe("Développement avancé");
    });

    it("accepte la variante de parcours écrite en fin de code", () => {
        expect(officialSubjectLabel("S3.01A")).toBe("Développement d’une application");
    });

    it("nomme le portfolio, que le programme ne code pas", () => {
        expect(officialSubjectLabel("P5A.01")).toBe("Démarche portfolio");
    });

    it("rend null pour ce que le programme ignore", () => {
        expect(officialSubjectLabel("S3.St")).toBeNull();
        expect(officialSubjectLabel("S5A.02")).toBeNull();
        expect(officialSubjectLabel("FERIE")).toBeNull();
    });

    it("ignore les ressources des autres parcours", () => {
        // Le parcours B nomme sa R5.04 « Programmation avancée en système » :
        // seule celle du parcours A doit sortir.
        expect(officialSubjectLabel("R5B.04")).toBeNull();
    });
});
