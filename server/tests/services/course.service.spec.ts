// ============================================
// 📁 tests/services/course.service.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import lessonRepository from "../../src/repository/lesson.repository.js";
import { CourseService } from "../../src/services/course.service.js";
import { census, lesson, studentGroup } from "../helpers/fixtures.js";

describe("CourseService", () => {
    const findMany = spyOn(lessonRepository, "findMany");
    const findAllTeachers = spyOn(lessonRepository, "findAllTeachers");
    const loadGroupCensus = spyOn(lessonRepository, "loadGroupCensus");

    const fenêtre = { start_at: "2026-09-07T00:00:00.000Z", end_at: "2026-09-14T00:00:00.000Z" };

    beforeEach(() => {
        findMany.mockClear();
        findAllTeachers.mockClear();
        loadGroupCensus.mockClear();
        loadGroupCensus.mockResolvedValue(census);
        findMany.mockResolvedValue([]);
        findAllTeachers.mockResolvedValue([]);
    });

    afterAll(() => {
        findMany.mockRestore();
        findAllTeachers.mockRestore();
        loadGroupCensus.mockRestore();
    });

    describe("getCourses", () => {
        it("traduit un cours en réponse d'API", async () => {
            findMany.mockResolvedValue([lesson()]);

            expect(await CourseService.instance.getCourses(fenêtre)).toEqual([
                {
                    code: "R5A.14",
                    title: "Anglais",
                    type: "TP",
                    rooms: ["R52"],
                    groups: ["G8A"],
                    teacher: "JP",
                    start_at: "2026-09-10T06:00:00.000Z",
                    end_at: "2026-09-10T08:00:00.000Z",
                },
            ]);
        });

        it("nomme « Inconnu » un cours sans enseignant", async () => {
            findMany.mockResolvedValue([lesson({ teacher: null })]);
            expect((await CourseService.instance.getCourses(fenêtre))[0]!.teacher).toBe("Inconnu");
        });

        it("rend une liste de salles vide quand elles ne sont pas chargées", async () => {
            findMany.mockResolvedValue([lesson({ rooms: [] })]);
            expect((await CourseService.instance.getCourses(fenêtre))[0]!.rooms).toEqual([]);
        });

        it("interroge la fenêtre en mode contenu", async () => {
            await CourseService.instance.getCourses(fenêtre);

            expect(findMany).toHaveBeenCalledWith({
                from: new Date(fenêtre.start_at),
                to: new Date(fenêtre.end_at),
                mode: "contained",
                groupCodes: undefined,
                roomNames: undefined,
                teacherNames: undefined,
            });
        });

        it("découpe et nettoie les listes de groupes et de salles", async () => {
            await CourseService.instance.getCourses({ ...fenêtre, groups: "G8a , G8b", rooms: " R52,R46 " });

            const appel = findMany.mock.calls[0]![0]!;
            expect(appel.groupCodes).toEqual(["G8a", "G8b"]);
            expect(appel.roomNames).toEqual(["R52", "R46"]);
        });

        it("retombe sur l'instant courant quand les bornes manquent", async () => {
            await CourseService.instance.getCourses({ start_at: "", end_at: "" });

            const appel = findMany.mock.calls[0]![0]!;
            expect(appel.from).toBeInstanceOf(Date);
            expect(appel.to).toBeInstanceOf(Date);
        });

        describe("résolution des enseignants", () => {
            it("accepte une correspondance exacte, quelle que soit la casse", async () => {
                findAllTeachers.mockResolvedValue([{ id: 1, name: "CO" }] as never);

                await CourseService.instance.getCourses({ ...fenêtre, teachers: "co" });

                expect(findMany.mock.calls[0]![0]!.teacherNames).toEqual(["CO"]);
            });

            it("accepte une correspondance partielle, accents ignorés", async () => {
                findAllTeachers.mockResolvedValue([{ id: 1, name: "Onete C." }] as never);

                await CourseService.instance.getCourses({ ...fenêtre, teachers: "onete" });

                expect(findMany.mock.calls[0]![0]!.teacherNames).toEqual(["Onete C."]);
            });

            it("préfère la correspondance exacte à la partielle", async () => {
                findAllTeachers.mockResolvedValue([{ id: 1, name: "Onete C." }, { id: 2, name: "CO" }] as never);

                await CourseService.instance.getCourses({ ...fenêtre, teachers: "CO" });

                expect(findMany.mock.calls[0]![0]!.teacherNames).toEqual(["CO"]);
            });

            it("réunit les formes d'un même enseignant", async () => {
                // La commande du bot envoie le nom et le code, sans lien entre eux.
                findAllTeachers.mockResolvedValue([{ id: 1, name: "Onete C." }, { id: 2, name: "CO" }] as never);

                await CourseService.instance.getCourses({ ...fenêtre, teachers: "Onete C.,CO" });

                expect(findMany.mock.calls[0]![0]!.teacherNames).toEqual(["Onete C.", "CO"]);
            });

            it("ignore une saisie vide", async () => {
                findAllTeachers.mockResolvedValue([{ id: 1, name: "CO" }] as never);

                await CourseService.instance.getCourses({ ...fenêtre, teachers: "CO, ,  " });

                expect(findMany.mock.calls[0]![0]!.teacherNames).toEqual(["CO"]);
            });

            it("renvoie une liste vide si aucun enseignant n'est reconnu", async () => {
                findAllTeachers.mockResolvedValue([{ id: 1, name: "CO" }] as never);

                expect(await CourseService.instance.getCourses({ ...fenêtre, teachers: "inconnu" })).toEqual([]);
                expect(findMany).not.toHaveBeenCalled();
            });
        });

        it("nomme les groupes au niveau réel du cours", async () => {
            findMany.mockResolvedValue([
                lesson({ groups: [studentGroup("G8a", "A3", 8, "a"), studentGroup("G8b", "A3", 8, "b")] }),
            ]);

            expect((await CourseService.instance.getCourses(fenêtre))[0]!.groups).toEqual(["G8"]);
        });
    });
});
