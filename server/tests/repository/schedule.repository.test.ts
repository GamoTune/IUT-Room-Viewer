// ============================================
// 📁 tests/repository/schedule.repository.test.ts
// ============================================

import { beforeEach, describe, expect, it } from "bun:test";

import { getLessonsByGroup, parseGroupName } from "../../src/repository/schedule.repository.js";
import { prismaEdtMock, resetPrismaMocks } from "../helpers/prisma-mock.js";
import { lessonFull } from "../helpers/fixtures.js";

describe("parseGroupName", () => {
    it("extrait le numéro de groupe quel que soit le préfixe", () => {
        expect(parseGroupName("G3")).toEqual({ mainGroup: 3, subGroup: undefined });
        expect(parseGroupName("g3")).toEqual({ mainGroup: 3, subGroup: undefined });
        expect(parseGroupName("A5")).toEqual({ mainGroup: 5, subGroup: undefined });
        expect(parseGroupName("7")).toEqual({ mainGroup: 7, subGroup: undefined });
    });

    it("retombe sur le groupe 1 quand aucun numéro n'est lisible", () => {
        expect(parseGroupName("inconnu").mainGroup).toBe(1);
    });

    it("traduit le TP en sous-groupe numérique", () => {
        expect(parseGroupName("G3", "A").subGroup).toBe(1);
        expect(parseGroupName("G3", "a").subGroup).toBe(1);
        expect(parseGroupName("G3", "B").subGroup).toBe(2);
    });

    it("ignore un TP non reconnu", () => {
        expect(parseGroupName("G3", "C").subGroup).toBeUndefined();
    });
});

describe("getLessonsByGroup", () => {
    const filter = {
        mainGroup: 1,
        yearMainGroup: -1,
        startDate: new Date("2026-09-07T00:00:00.000Z"),
        endDate: new Date("2026-09-07T23:59:59.999Z"),
    };

    beforeEach(() => {
        resetPrismaMocks();
    });

    /** Conditions de groupe passées à Prisma. */
    function groupConditions(): any {
        const arg: any = prismaEdtMock.lesson.findMany.mock.calls[0]?.[0];
        return arg.where.lesson_group.some.group;
    }

    it("borne la recherche sur la journée demandée", async () => {
        await getLessonsByGroup(filter);

        const arg: any = prismaEdtMock.lesson.findMany.mock.calls[0]?.[0];
        expect(arg.where.start_datetime).toEqual({
            gte: filter.startDate,
            lt: filter.endDate,
        });
        expect(arg.orderBy).toEqual({ start_datetime: "asc" });
    });

    it("sans sous-groupe, prend le groupe entier et les cours de promo", async () => {
        await getLessonsByGroup(filter);

        expect(groupConditions()).toEqual({
            OR: [{ main_group: 1 }, { main_group: -1 }],
        });
    });

    it("avec un sous-groupe, ajoute les cours communs au groupe (-1 et 0)", async () => {
        await getLessonsByGroup({ ...filter, subGroup: 1 });

        expect(groupConditions()).toEqual({
            OR: [
                { main_group: 1, sub_group: { in: [-1, 0, 1] } },
                { main_group: -1 },
            ],
        });
    });

    it("traite un sous-groupe nul comme une absence de sous-groupe", async () => {
        await getLessonsByGroup({ ...filter, subGroup: 0 });

        expect(groupConditions()).toEqual({
            OR: [{ main_group: 1 }, { main_group: -1 }],
        });
    });

    it("retourne les cours avec leurs relations", async () => {
        const lessons = [lessonFull()];
        prismaEdtMock.lesson.findMany.mockResolvedValue(lessons);

        expect(await getLessonsByGroup(filter)).toBe(lessons);

        const arg: any = prismaEdtMock.lesson.findMany.mock.calls[0]?.[0];
        expect(arg.include.content).toBe(true);
        expect(arg.include.teacher).toBe(true);
        expect(arg.include.lesson_room.include.room).toBe(true);
        expect(arg.include.lesson_group.include.group).toBe(true);
    });
});
