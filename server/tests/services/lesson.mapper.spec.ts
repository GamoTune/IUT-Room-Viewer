// ============================================
// 📁 tests/services/lesson.mapper.spec.ts
// ============================================

import { describe, expect, it } from "bun:test";
import { groupsOf, toGroupLabels, toGroupRefs, toLessonResponse } from "../../src/services/lesson.mapper.js";
import type { GroupCensus } from "../../src/repository/lesson.repository.js";
import type { Lesson } from "../../src/entities/lesson.entity.js";
import type { StudentGroup } from "../../src/entities/studentGroup.entity.js";

/** Un sous-groupe du référentiel, réduit aux champs que le mapper consulte. */
function group(code: string, year: string, mainGroup: number, subGroup: string | null): StudentGroup {
    return { id: 0, code, year, mainGroup, subGroup } as StudentGroup;
}

/** Recensement type : trois années de trois groupes dédoublés. */
const census: GroupCensus = {
    perYear: new Map([
        ["A1", 6],
        ["A2", 6],
        ["A3", 6],
    ]),
    perMainGroup: new Map([
        [1, 2],
        [2, 2],
        [7, 2],
        [8, 2],
    ]),
};

describe("toGroupRefs", () => {
    it("rend une liste vide sans groupe", () => {
        expect(toGroupRefs([], census)).toEqual([]);
    });

    it("réduit tous les sous-groupes d'une année à la promotion", () => {
        const tous = [
            group("G1a", "A1", 1, "a"),
            group("G1b", "A1", 1, "b"),
            group("G2a", "A1", 2, "a"),
            group("G2b", "A1", 2, "b"),
            group("G3a", "A1", 3, "a"),
            group("G3b", "A1", 3, "b"),
        ];
        // -1 désigne A1, comme l'attend le bot.
        expect(toGroupRefs(tous, census)).toEqual([{ mainGroup: -1, subGroup: -1 }]);
    });

    it("traduit A2 et A3 par leur identifiant négatif", () => {
        const a2 = Array.from({ length: 6 }, (_, i) => group(`G${i}a`, "A2", i, "a"));
        expect(toGroupRefs(a2, census)[0]!.mainGroup).toBe(-2);

        const a3 = Array.from({ length: 6 }, (_, i) => group(`G${i}a`, "A3", i, "a"));
        expect(toGroupRefs(a3, census)[0]!.mainGroup).toBe(-3);
    });

    it("réduit les deux sous-groupes d'un groupe au groupe entier", () => {
        const g8 = [group("G8a", "A3", 8, "a"), group("G8b", "A3", 8, "b")];
        expect(toGroupRefs(g8, census)).toEqual([{ mainGroup: 8, subGroup: -1 }]);
    });

    it("garde le sous-groupe quand il est seul", () => {
        expect(toGroupRefs([group("G8a", "A3", 8, "a")], census)).toEqual([{ mainGroup: 8, subGroup: 1 }]);
        expect(toGroupRefs([group("G8b", "A3", 8, "b")], census)).toEqual([{ mainGroup: 8, subGroup: 2 }]);
    });

    it("rend -1 en sous-groupe pour un groupe sans lettre", () => {
        expect(toGroupRefs([group("G8", "A3", 8, null)], census)).toEqual([{ mainGroup: 8, subGroup: -1 }]);
    });

    it("trie les références par groupe puis par sous-groupe", () => {
        const mélange = [group("G8b", "A3", 8, "b"), group("G7a", "A3", 7, "a")];
        expect(toGroupRefs(mélange, census)).toEqual([
            { mainGroup: 7, subGroup: 1 },
            { mainGroup: 8, subGroup: 2 },
        ]);
    });

    it("ne réduit pas à la promotion quand l'année est inconnue du recensement", () => {
        const vide: GroupCensus = { perYear: new Map(), perMainGroup: new Map() };
        expect(toGroupRefs([group("G8a", "A3", 8, "a")], vide)).toEqual([{ mainGroup: 8, subGroup: 1 }]);
    });

    it("ne mélange pas deux années dans une même réduction", () => {
        const deux = [group("G1a", "A1", 1, "a"), group("G8a", "A3", 8, "a")];
        expect(toGroupRefs(deux, census)).toEqual([
            { mainGroup: 1, subGroup: 1 },
            { mainGroup: 8, subGroup: 1 },
        ]);
    });
});

describe("toGroupLabels", () => {
    it("nomme une promotion par son année", () => {
        const tous = Array.from({ length: 6 }, (_, i) => group(`G${i}a`, "A1", i, "a"));
        expect(toGroupLabels(tous, census)).toEqual(["A1"]);
    });

    it("nomme un groupe entier sans lettre", () => {
        const g8 = [group("G8a", "A3", 8, "a"), group("G8b", "A3", 8, "b")];
        expect(toGroupLabels(g8, census)).toEqual(["G8"]);
    });

    it("nomme un sous-groupe avec sa lettre en majuscule", () => {
        expect(toGroupLabels([group("G8a", "A3", 8, "a")], census)).toEqual(["G8A"]);
        expect(toGroupLabels([group("G8b", "A3", 8, "b")], census)).toEqual(["G8B"]);
    });
});

describe("groupsOf", () => {
    it("extrait les groupes des liaisons", () => {
        const g8a = group("G8a", "A3", 8, "a");
        const lesson = { groups: [{ group: g8a }] } as Lesson;
        expect(groupsOf(lesson)).toEqual([g8a]);
    });

    it("écarte une liaison sans groupe chargé", () => {
        const lesson = { groups: [{ group: null }, { group: undefined }] } as unknown as Lesson;
        expect(groupsOf(lesson)).toEqual([]);
    });

    it("rend une liste vide quand les liaisons ne sont pas chargées", () => {
        expect(groupsOf({} as Lesson)).toEqual([]);
    });
});

describe("toLessonResponse", () => {
    /** Un cours complet, tel que le repository le charge. */
    const cours = {
        id: 42,
        type: "TP",
        startUtc: new Date("2026-09-10T06:00:00.000Z"),
        endUtc: new Date("2026-09-10T08:00:00.000Z"),
        rooms: [{ name: "R52" }],
        teacher: { name: "JP" },
        subject: { code: "R5A.14", label: "Anglais" },
        groups: [{ group: group("G8a", "A3", 8, "a") }],
    } as unknown as Lesson;

    it("traduit un cours en réponse d'API", () => {
        expect(toLessonResponse(cours, census)).toEqual({
            id: 42,
            type: "TP",
            startTime: "2026-09-10T06:00:00.000Z",
            endTime: "2026-09-10T08:00:00.000Z",
            rooms: ["R52"],
            teacher: "JP",
            contentCode: "R5A.14",
            contentName: "Anglais",
            groups: [{ mainGroup: 8, subGroup: 1 }],
        });
    });

    it("rend un enseignant nul quand le cours n'en a pas", () => {
        const sansProf = { ...cours, teacher: null } as unknown as Lesson;
        expect(toLessonResponse(sansProf, census).teacher).toBeNull();
    });

    it("rend une liste de salles vide quand elles ne sont pas chargées", () => {
        const sansSalle = { ...cours, rooms: undefined } as unknown as Lesson;
        expect(toLessonResponse(sansSalle, census).rooms).toEqual([]);
    });
});
