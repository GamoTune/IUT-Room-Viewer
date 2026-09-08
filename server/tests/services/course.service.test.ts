// ============================================
// 📁 tests/services/course.service.test.ts
// ============================================

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

import { CourseService } from "../../src/services/course.service.js";
import { CourseRepository } from "../../src/repository/course.repository.js";
import { courseResult } from "../helpers/fixtures.js";

const TEACHERS = [
    { id: 1, name: "Hugel T." },
    { id: 2, name: "TH" },
    { id: 3, name: "Léger Rémi" },
    { id: 4, name: "LR" },
];

let findMany: ReturnType<typeof spyOn>;
let findAllTeachers: ReturnType<typeof spyOn>;

const PERIOD = {
    start_at: "2026-09-07T00:00:00.000Z",
    end_at: "2026-09-13T23:59:59.000Z",
};

describe("CourseService.getCourses", () => {
    beforeEach(() => {
        findMany = spyOn(CourseRepository.instance, "findMany").mockResolvedValue([]);
        findAllTeachers = spyOn(CourseRepository.instance, "findAllTeachers")
            .mockResolvedValue(TEACHERS);
    });

    afterEach(() => {
        mock.restore();
    });

    describe("préparation des paramètres", () => {
        it("convertit les dates ISO en objets Date", async () => {
            await CourseService.instance.getCourses(PERIOD);

            const params = findMany.mock.calls[0]![0] as any;
            expect(params.start_at).toEqual(new Date(PERIOD.start_at));
            expect(params.end_at).toEqual(new Date(PERIOD.end_at));
        });

        it("découpe les listes de groupes et de salles sur les virgules", async () => {
            await CourseService.instance.getCourses({
                ...PERIOD,
                groups: "G1A,G1B",
                rooms: "S101,S102",
            });

            const params = findMany.mock.calls[0]![0] as any;
            expect(params.groups).toEqual(["G1A", "G1B"]);
            expect(params.rooms).toEqual(["S101", "S102"]);
        });

        it("laisse les filtres indéfinis quand ils ne sont pas fournis", async () => {
            await CourseService.instance.getCourses(PERIOD);

            const params = findMany.mock.calls[0]![0] as any;
            expect(params.groups).toBeUndefined();
            expect(params.rooms).toBeUndefined();
            expect(params.teachers).toBeUndefined();
        });
    });

    describe("résolution des enseignants", () => {
        it("traite une saisie courte comme un alias, sans tenir compte de la casse", async () => {
            await CourseService.instance.getCourses({ ...PERIOD, teachers: "th" });

            expect((findMany.mock.calls[0]![0] as any).teachers).toEqual(["TH"]);
        });

        it("retrouve un nom complet malgré les accents et la casse", async () => {
            await CourseService.instance.getCourses({ ...PERIOD, teachers: "leger remi" });

            expect((findMany.mock.calls[0]![0] as any).teachers).toEqual(["Léger Rémi"]);
        });

        it("retrouve un nom complet à partir d'une saisie partielle", async () => {
            await CourseService.instance.getCourses({ ...PERIOD, teachers: "Hugel" });

            expect((findMany.mock.calls[0]![0] as any).teachers).toEqual(["Hugel T."]);
        });

        it("ignore les espaces autour de la saisie", async () => {
            await CourseService.instance.getCourses({ ...PERIOD, teachers: "  TH  " });

            expect((findMany.mock.calls[0]![0] as any).teachers).toEqual(["TH"]);
        });

        it("résout plusieurs enseignants séparés par des virgules", async () => {
            await CourseService.instance.getCourses({ ...PERIOD, teachers: "TH,Léger Rémi" });

            expect((findMany.mock.calls[0]![0] as any).teachers).toEqual(["TH", "Léger Rémi"]);
        });

        it("retourne une liste vide sans interroger les cours si aucun prof ne correspond", async () => {
            const courses = await CourseService.instance.getCourses({
                ...PERIOD,
                teachers: "Personne Inexistante",
            });

            expect(courses).toEqual([]);
            expect(findMany).not.toHaveBeenCalled();
        });

        it("ne charge pas la liste des enseignants quand aucun filtre prof n'est demandé", async () => {
            await CourseService.instance.getCourses(PERIOD);

            expect(findAllTeachers).not.toHaveBeenCalled();
        });
    });

    describe("mise en forme des cours", () => {
        it("aplatit salles et groupes et sérialise les dates en ISO", async () => {
            findMany.mockResolvedValue([
                courseResult({
                    lesson_room: [
                        { lesson_id: 1, room_id: 40, room: { id: 40, name: "S101" } },
                        { lesson_id: 1, room_id: 41, room: { id: 41, name: "S102" } },
                    ],
                }),
            ]);

            const [course] = await CourseService.instance.getCourses(PERIOD);

            expect(course).toEqual({
                code: "R3.01",
                title: "Développement web",
                type: "TP",
                rooms: ["S101", "S102"],
                groups: ["G1A"],
                teacher: "Hugel T.",
                start_at: "2026-09-07T08:00:00.000Z",
                end_at: "2026-09-07T10:00:00.000Z",
            });
        });

        it("affiche « Inconnu » quand le cours n'a pas d'enseignant", async () => {
            findMany.mockResolvedValue([courseResult({ teacher: null })]);

            const [course] = await CourseService.instance.getCourses(PERIOD);

            expect(course!.teacher).toBe("Inconnu");
        });

        it("affiche « Inconnu » quand l'enseignant existe sans nom", async () => {
            findMany.mockResolvedValue([courseResult({ teacher: { id: 20, name: null } })]);

            const [course] = await CourseService.instance.getCourses(PERIOD);

            expect(course!.teacher).toBe("Inconnu");
        });

        it("remplace un nom de groupe absent par une chaîne vide", async () => {
            findMany.mockResolvedValue([
                courseResult({
                    lesson_group: [{ lesson_id: 1, group_id: 50, group: { name: null } }],
                }),
            ]);

            const [course] = await CourseService.instance.getCourses(PERIOD);

            expect(course!.groups).toEqual([""]);
        });

        it("retourne une liste vide quand aucun cours ne correspond", async () => {
            expect(await CourseService.instance.getCourses(PERIOD)).toEqual([]);
        });
    });
});
