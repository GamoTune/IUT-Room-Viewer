// ============================================
// 📁 tests/repository/course.repository.test.ts
// ============================================

import { beforeEach, describe, expect, it } from "bun:test";

import { CourseRepository } from "../../src/repository/course.repository.js";
import { prismaEdtMock, resetPrismaMocks } from "../helpers/prisma-mock.js";
import { courseResult } from "../helpers/fixtures.js";

const BASE_PARAMS = {
    start_at: new Date("2026-09-07T00:00:00.000Z"),
    end_at: new Date("2026-09-13T23:59:59.000Z"),
};

/** Récupère l'objet passé à `prisma.lesson.findMany`. */
function lastFindManyArg(): any {
    return prismaEdtMock.lesson.findMany.mock.calls[0]?.[0];
}

describe("CourseRepository.findMany", () => {
    beforeEach(() => {
        resetPrismaMocks();
    });

    it("borne la recherche sur la fenêtre demandée et trie par date de début", async () => {
        await CourseRepository.instance.findMany(BASE_PARAMS);

        const arg = lastFindManyArg();
        expect(arg.where.start_datetime).toEqual({ gte: BASE_PARAMS.start_at });
        expect(arg.where.end_datetime).toEqual({ lte: BASE_PARAMS.end_at });
        expect(arg.orderBy).toEqual({ start_datetime: "asc" });
    });

    it("filtre sur les groupes, salles et enseignants fournis", async () => {
        await CourseRepository.instance.findMany({
            ...BASE_PARAMS,
            groups: ["G1A", "G1B"],
            rooms: ["S101"],
            teachers: ["Hugel T."],
        });

        const where = lastFindManyArg().where;
        expect(where.lesson_group.some.group.name).toEqual({ in: ["G1A", "G1B"] });
        expect(where.lesson_room.some.room.name).toEqual({ in: ["S101"] });
        expect(where.teacher.name).toEqual({ in: ["Hugel T."] });
    });

    it("n'exclut aucun cours quand aucun filtre n'est fourni", async () => {
        await CourseRepository.instance.findMany(BASE_PARAMS);

        const where = lastFindManyArg().where;
        expect(where.lesson_group.some.group.name).toEqual({ not: undefined });
        expect(where.lesson_room.some.room.name).toEqual({ not: undefined });
        expect(where.teacher.name).toEqual({ not: undefined });
    });

    it("charge les relations nécessaires au mapping (matière, prof, salles, groupes)", async () => {
        await CourseRepository.instance.findMany(BASE_PARAMS);

        const include = lastFindManyArg().include;
        expect(include.content).toBe(true);
        expect(include.teacher).toBe(true);
        expect(include.lesson_room.include.room).toBe(true);
        expect(include.lesson_group.include.group.select.name).toBe(true);
    });

    it("retourne les lignes du client Prisma telles quelles", async () => {
        const rows = [courseResult()];
        prismaEdtMock.lesson.findMany.mockResolvedValue(rows);

        expect(await CourseRepository.instance.findMany(BASE_PARAMS)).toBe(rows);
    });
});

describe("CourseRepository.findAllTeachers", () => {
    beforeEach(() => {
        resetPrismaMocks();
    });

    it("ne sélectionne que l'identifiant et le nom", async () => {
        prismaEdtMock.teacher.findMany.mockResolvedValue([{ id: 1, name: "Hugel T." }]);

        const teachers = await CourseRepository.instance.findAllTeachers();

        expect(prismaEdtMock.teacher.findMany).toHaveBeenCalledWith({
            select: { id: true, name: true },
        });
        expect(teachers).toEqual([{ id: 1, name: "Hugel T." }]);
    });
});
