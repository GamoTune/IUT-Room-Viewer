// ============================================
// 📁 tests/services/group.service.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import groupRepository from "../../src/repository/group.repository.js";
import { GroupService } from "../../src/services/group.service.js";
import { studentGroup } from "../helpers/fixtures.js";

describe("GroupService", () => {
    const findAll = spyOn(groupRepository, "findAll");

    // `mockReset` de Bun restaure l'implémentation d'origine, contrairement à
    // Jest : le vrai repository serait rappelé, sans base derrière.
    beforeEach(() => {
        findAll.mockClear();
    });

    // Restauration en fin de fichier seulement : `mockRestore` rendrait sinon
    // l'implémentation d'origine dès le deuxième test.
    afterAll(() => {
        findAll.mockRestore();
    });

    describe("getAllGroups", () => {
        it("compose le libellé d'affichage depuis le groupe et son sous-groupe", async () => {
            findAll.mockResolvedValue([studentGroup("G8a", "A3", 8, "a")]);

            expect(await GroupService.instance.getAllGroups()).toEqual([
                { code: "G8a", label: "G8A", year: "A3", mainGroup: 8, subGroup: "a" },
            ]);
        });

        it("omet la lettre pour un groupe sans sous-groupe", async () => {
            findAll.mockResolvedValue([studentGroup("G8", "A3", 8, null)]);

            expect((await GroupService.instance.getAllGroups())[0]!.label).toBe("G8");
        });

        it("rend une liste vide quand le référentiel l'est", async () => {
            findAll.mockResolvedValue([]);
            expect(await GroupService.instance.getAllGroups()).toEqual([]);
        });
    });
});
