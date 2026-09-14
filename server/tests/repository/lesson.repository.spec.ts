// ============================================
// 📁 tests/repository/lesson.repository.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import dataSource from "../../src/utils/dataSource.js";
import { Lesson } from "../../src/entities/lesson.entity.js";
import { Room } from "../../src/entities/room.entity.js";
import { StudentGroup } from "../../src/entities/studentGroup.entity.js";
import { Teacher } from "../../src/entities/teacher.entity.js";
import lessonRepository from "../../src/repository/lesson.repository.js";

/** Conditions posées sur une requête, dans l'ordre. */
interface Condition {
    sql: string;
    params: Record<string, unknown>;
}

describe("LessonRepository", () => {
    const createQueryBuilder = spyOn(dataSource, "createQueryBuilder");
    const getRepository = spyOn(dataSource, "getRepository");

    const find = mock();
    const getRawMany = mock();
    let conditions: Condition[] = [];

    /** Constructeur de requête chaînable, qui retient ce qu'on lui demande. */
    function fauxBuilder() {
        const builder = {
            select: () => builder,
            orderBy: () => builder,
            where: (sql: string, params: Record<string, unknown>) => {
                conditions.push({ sql, params });
                return builder;
            },
            andWhere: (sql: string, params: Record<string, unknown>) => {
                conditions.push({ sql, params });
                return builder;
            },
            getRawMany,
        };
        return builder;
    }

    const fenêtre = { from: new Date("2026-09-10T06:00:00.000Z"), to: new Date("2026-09-10T08:00:00.000Z") };

    beforeEach(() => {
        conditions = [];
        find.mockClear();
        getRawMany.mockClear();
        find.mockResolvedValue([]);
        getRawMany.mockResolvedValue([]);
        createQueryBuilder.mockImplementation(fauxBuilder as never);
        getRepository.mockImplementation((() => ({ find })) as never);
    });

    afterAll(() => {
        createQueryBuilder.mockRestore();
        getRepository.mockRestore();
    });

    describe("findMany", () => {
        it("ne charge rien quand aucun cours ne correspond", async () => {
            expect(await lessonRepository.findMany({ ...fenêtre, mode: "overlap" })).toEqual([]);
            expect(find).not.toHaveBeenCalled();
        });

        it("charge les cours retenus avec toutes leurs relations", async () => {
            getRawMany.mockResolvedValue([{ id: 7 }, { id: 9 }]);
            const cours = [{ id: 7 }, { id: 9 }];
            find.mockResolvedValue(cours);

            expect(await lessonRepository.findMany({ ...fenêtre, mode: "overlap" })).toBe(cours as never);

            const options = find.mock.calls[0]![0] as { relations: Record<string, unknown> };
            expect(Object.keys(options.relations)).toEqual(["subject", "teacher", "rooms", "groups"]);
        });

        it("filtre par groupe, salle et enseignant en sous-requêtes", async () => {
            getRawMany.mockResolvedValue([{ id: 1 }]);

            await lessonRepository.findMany({
                ...fenêtre,
                mode: "overlap",
                groupCodes: ["G8a"],
                roomNames: ["R52"],
                teacherNames: ["JP"],
            });

            const sql = conditions.map((c) => c.sql).join(" ");
            expect(sql).toContain("lesson_group");
            expect(sql).toContain("lesson_room");
            expect(sql).toContain("teacher");
            expect(conditions).toHaveLength(4);
        });

        it("ignore les filtres relationnels vides", async () => {
            await lessonRepository.findMany({
                ...fenêtre,
                mode: "overlap",
                groupCodes: [],
                roomNames: [],
                teacherNames: [],
            });

            expect(conditions).toHaveLength(1);
        });
    });

    describe("fenêtre temporelle", () => {
        const conditionDe = async (filtre: Parameters<typeof lessonRepository.findMany>[0]) => {
            await lessonRepository.findMany(filtre);
            return conditions[0]!;
        };

        it("mode `start` : borne le début du cours", async () => {
            const { sql } = await conditionDe({ ...fenêtre, mode: "start" });
            expect(sql).toBe("lesson.start_utc >= :from AND lesson.start_utc < :to");
        });

        it("mode `contained` : exige le cours entier dans la fenêtre", async () => {
            const { sql } = await conditionDe({ ...fenêtre, mode: "contained" });
            expect(sql).toBe("lesson.start_utc >= :from AND lesson.end_utc <= :to");
        });

        it("mode `overlap` : retient tout cours qui déborde sur la fenêtre", async () => {
            const { sql } = await conditionDe({ ...fenêtre, mode: "overlap" });
            expect(sql).toBe("lesson.start_utc < :to AND lesson.end_utc > :from");
        });

        it("interroge un instant quand les bornes se confondent", async () => {
            // `/salles_maintenant` : un cours qui commence pile à cet instant
            // occupe déjà la salle, d'où le `<=`.
            const instant = new Date("2026-09-10T07:00:00.000Z");
            const { sql, params } = await conditionDe({ from: instant, to: instant, mode: "overlap" });

            expect(sql).toBe("lesson.start_utc <= :instant AND lesson.end_utc > :instant");
            expect(params).toEqual({ instant });
        });

        it("traite de même une fenêtre inversée", async () => {
            const { sql } = await conditionDe({ from: fenêtre.to, to: fenêtre.from, mode: "overlap" });
            expect(sql).toContain(":instant");
        });
    });

    describe("référentiels", () => {
        it("rend les salles dans l'ordre d'affichage", async () => {
            await lessonRepository.findAllRooms();

            expect(getRepository).toHaveBeenCalledWith(Room);
            expect(find).toHaveBeenCalledWith({ order: { displayOrder: "ASC" } });
        });

        it("rend les enseignants par ordre alphabétique", async () => {
            await lessonRepository.findAllTeachers();

            expect(getRepository).toHaveBeenCalledWith(Teacher);
            expect(find).toHaveBeenCalledWith({ order: { name: "ASC" } });
        });
    });

    describe("loadGroupCensus", () => {
        it("compte les sous-groupes par année et par groupe principal", async () => {
            find.mockResolvedValue([
                { year: "A3", mainGroup: 8 },
                { year: "A3", mainGroup: 8 },
                { year: "A3", mainGroup: 7 },
                { year: "A1", mainGroup: 1 },
            ]);

            const census = await lessonRepository.loadGroupCensus();

            expect(getRepository).toHaveBeenCalledWith(StudentGroup);
            expect(census.perYear.get("A3")).toBe(3);
            expect(census.perYear.get("A1")).toBe(1);
            expect(census.perMainGroup.get(8)).toBe(2);
            expect(census.perMainGroup.get(7)).toBe(1);
        });

        it("rend un recensement vide sans groupe", async () => {
            const census = await lessonRepository.loadGroupCensus();
            expect(census.perYear.size).toBe(0);
            expect(census.perMainGroup.size).toBe(0);
        });
    });

    it("interroge bien l'entité des cours", async () => {
        getRawMany.mockResolvedValue([{ id: 1 }]);
        await lessonRepository.findMany({ ...fenêtre, mode: "overlap" });
        expect(createQueryBuilder).toHaveBeenCalledWith(Lesson, "lesson");
    });
});
