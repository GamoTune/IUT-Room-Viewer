// ============================================
// 📁 tests/sync/groups.spec.ts
// ============================================

import { describe, expect, it } from "bun:test";
import { parseGroupCode, subGroupCodes } from "../../src/sync/groups.js";

describe("parseGroupCode", () => {
    it("décompose un sous-groupe", () => {
        expect(parseGroupCode("G8a")).toEqual({ mainGroup: 8, subGroup: "a" });
    });

    it("reconnaît un groupe entier, sans lettre", () => {
        expect(parseGroupCode("G8")).toEqual({ mainGroup: 8, subGroup: null });
    });

    it("ramène la lettre en minuscule", () => {
        expect(parseGroupCode("G8B")).toEqual({ mainGroup: 8, subGroup: "b" });
    });

    it("accepte un numéro à plusieurs chiffres", () => {
        expect(parseGroupCode("G12a")).toEqual({ mainGroup: 12, subGroup: "a" });
    });

    it("rejette un code d'une autre forme", () => {
        expect(parseGroupCode("A1")).toBeNull();
        expect(parseGroupCode("G")).toBeNull();
        expect(parseGroupCode("")).toBeNull();
        expect(parseGroupCode("G8ab")).toBeNull();
    });
});

describe("subGroupCodes", () => {
    it("rend les deux sous-groupes dans l'ordre d'affichage", () => {
        // `a` est au-dessus de `b` dans les emplois du temps publiés.
        expect(subGroupCodes(8)).toEqual(["G8a", "G8b"]);
    });
});
