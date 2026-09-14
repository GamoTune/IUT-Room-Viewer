// ============================================
// 📁 tests/services/schedule.service.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import lessonRepository from "../../src/repository/lesson.repository.js";
import { getScheduleForGroup, parseGroupName } from "../../src/services/schedule.service.js";
import { lesson } from "../helpers/fixtures.js";

describe("parseGroupName", () => {
    it("extrait le numéro d'un libellé de groupe", () => {
        expect(parseGroupName("G3")).toBe(3);
        expect(parseGroupName("g8")).toBe(8);
        expect(parseGroupName("A1")).toBe(1);
        expect(parseGroupName("12")).toBe(12);
    });

    it("retombe sur 1 quand aucun numéro n'apparaît", () => {
        expect(parseGroupName("inconnu")).toBe(1);
        expect(parseGroupName("")).toBe(1);
    });
});

describe("getScheduleForGroup", () => {
    const findMany = spyOn(lessonRepository, "findMany");

    beforeEach(() => {
        findMany.mockClear();
        findMany.mockResolvedValue([]);
    });

    afterAll(() => {
        findMany.mockRestore();
    });

    it("déduit l'année du numéro de groupe", async () => {
        expect((await getScheduleForGroup({ group: "G2", date: "2026-09-10" })).year).toBe("BUT1");
        expect((await getScheduleForGroup({ group: "G4", date: "2026-09-10" })).year).toBe("BUT2");
        expect((await getScheduleForGroup({ group: "G8", date: "2026-09-10" })).year).toBe("BUT3");
    });

    it("retombe sur BUT1 pour un numéro hors des plages connues", async () => {
        expect((await getScheduleForGroup({ group: "G6", date: "2026-09-10" })).year).toBe("BUT1");
        expect((await getScheduleForGroup({ group: "G99", date: "2026-09-10" })).year).toBe("BUT1");
    });

    it("interroge les deux sous-groupes sans précision de TP", async () => {
        // Un cours commun n'est stocké qu'une fois : l'interroger deux fois ne le duplique pas.
        await getScheduleForGroup({ group: "G3", date: "2026-09-10" });
        expect(findMany.mock.calls[0]![0]!.groupCodes).toEqual(["G3a", "G3b"]);
    });

    it("restreint au sous-groupe demandé", async () => {
        await getScheduleForGroup({ group: "G3", tp: " B ", date: "2026-09-10" });
        expect(findMany.mock.calls[0]![0]!.groupCodes).toEqual(["G3b"]);
    });

    it("ignore un TP d'une autre forme", async () => {
        await getScheduleForGroup({ group: "G3", tp: "c", date: "2026-09-10" });
        expect(findMany.mock.calls[0]![0]!.groupCodes).toEqual(["G3a", "G3b"]);
    });

    it("borne la fenêtre à la journée demandée", async () => {
        await getScheduleForGroup({ group: "G3", date: "2026-09-10" });

        const { from, to, mode } = findMany.mock.calls[0]![0]!;
        expect(mode).toBe("start");
        expect(from.getHours()).toBe(0);
        expect(to.getHours()).toBe(23);
    });

    it("prend le jour courant sans date", async () => {
        const réponse = await getScheduleForGroup({ group: "G3" });
        expect(réponse.date).toBe(new Date().toISOString().split("T")[0]);
    });

    it("traduit un cours en entrée d'emploi du temps", async () => {
        findMany.mockResolvedValue([lesson()]);

        const { courses } = await getScheduleForGroup({ group: "G8", date: "2026-09-10" });

        expect(courses).toEqual([
            {
                id: 1,
                code: "R5A.14",
                title: "Anglais",
                startTime: "2026-09-10T06:00:00.000Z",
                endTime: "2026-09-10T08:00:00.000Z",
                room: "R52",
                teacher: "JP",
                type: "TP",
            },
        ]);
    });

    it("joint les salles multiples et signale l'absence de salle", async () => {
        findMany.mockResolvedValue([lesson({ rooms: ["108", "109"] }), lesson({ id: 2, rooms: [] })]);

        const { courses } = await getScheduleForGroup({ group: "G8", date: "2026-09-10" });
        expect(courses[0]!.room).toBe("108, 109");
        expect(courses[1]!.room).toBe("N/A");
    });

    it("laisse l'enseignant indéfini quand le cours n'en a pas", async () => {
        findMany.mockResolvedValue([lesson({ teacher: null })]);

        const { courses } = await getScheduleForGroup({ group: "G8", date: "2026-09-10" });
        expect(courses[0]!.teacher).toBeUndefined();
    });

    describe("type de séance", () => {
        const typeDu = async (options: Parameters<typeof lesson>[0]) => {
            findMany.mockResolvedValue([lesson(options)]);
            const { courses } = await getScheduleForGroup({ group: "G8", date: "2026-09-10" });
            return courses[0]!.type;
        };

        it("reconnaît une SAÉ à son code, avant tout autre indice", async () => {
            // Les documents la publient comme un TD ou un cours ordinaire.
            expect(await typeDu({ code: "S5A.01", type: "TD" })).toBe("SAE");
        });

        it("reprend le type de la séance quand il est connu", async () => {
            expect(await typeDu({ code: "R1.01", type: "CM" })).toBe("CM");
            expect(await typeDu({ code: "R1.01", type: "TD" })).toBe("TD");
            expect(await typeDu({ code: "R1.01", type: "TP" })).toBe("TP");
            expect(await typeDu({ code: "R1.01", type: "SAE" })).toBe("SAE");
            expect(await typeDu({ code: "R1.01", type: "DS" })).toBe("DS");
            expect(await typeDu({ code: "R1.01", type: "EXAM" })).toBe("DS");
        });

        it("interroge le titre quand le type ne dit rien", async () => {
            expect(await typeDu({ code: "R1.01", type: "OTHER", label: "Cours en amphi" })).toBe("CM");
            expect(await typeDu({ code: "R1.01", type: "OTHER", label: "séance TP" })).toBe("TP");
            expect(await typeDu({ code: "R1.01", type: "OTHER", label: "séance TD" })).toBe("TD");
            expect(await typeDu({ code: "R1.01", type: "OTHER", label: "projet SAE" })).toBe("SAE");
            expect(await typeDu({ code: "R1.01", type: "OTHER", label: "EXAMEN final" })).toBe("DS");
        });

        it("range en « Autre » ce qu'aucun indice ne qualifie", async () => {
            expect(await typeDu({ code: "R1.01", type: "OTHER", label: "Réunion" })).toBe("Autre");
        });
    });
});
