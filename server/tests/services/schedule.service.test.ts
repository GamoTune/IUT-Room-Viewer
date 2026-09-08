// ============================================
// 📁 tests/services/schedule.service.test.ts
// ============================================
//
// Le service consomme des fonctions exportées par le repository, qu'on ne peut
// pas espionner comme les méthodes d'une classe. La frontière de test est donc
// le client Prisma (remplacé par `tests/setup.ts`) : le vrai repository traduit
// le filtre, et les conditions envoyées à Prisma restent vérifiables ici.

import { beforeEach, describe, expect, it } from "bun:test";

import { getScheduleForGroup } from "../../src/services/schedule.service.js";
import { prismaEdtMock, resetPrismaMocks } from "../helpers/prisma-mock.js";
import { lessonFull } from "../helpers/fixtures.js";

/** Arguments passés à Prisma lors de la recherche des cours. */
function lastQuery(): any {
    return prismaEdtMock.lesson.findMany.mock.calls[0]?.[0];
}

/** Conditions de groupe issues du filtre construit par le service. */
function groupConditions(): any {
    return lastQuery().where.lesson_group.some.group;
}

describe("getScheduleForGroup", () => {
    beforeEach(() => {
        resetPrismaMocks();
    });

    describe("déduction de l'année", () => {
        it("classe les groupes 1 à 3 en BUT1", async () => {
            for (const group of ["G1", "G2", "G3"]) {
                resetPrismaMocks();
                expect((await getScheduleForGroup({ group })).year).toBe("BUT1");
            }
        });

        it("classe les groupes 4 et 5 en BUT2", async () => {
            for (const group of ["G4", "G5"]) {
                resetPrismaMocks();
                expect((await getScheduleForGroup({ group })).year).toBe("BUT2");
            }
        });

        it("classe les groupes 7 et 8 en BUT3", async () => {
            for (const group of ["G7", "G8"]) {
                resetPrismaMocks();
                expect((await getScheduleForGroup({ group })).year).toBe("BUT3");
            }
        });

        it("retombe sur BUT1 pour un groupe hors barème", async () => {
            expect((await getScheduleForGroup({ group: "G6" })).year).toBe("BUT1");
        });

        it("cherche aussi les cours de promo, sous forme de groupe négatif", async () => {
            await getScheduleForGroup({ group: "G4" });

            // BUT2 → -2 : les CM de promo sont rattachés à ce groupe fictif.
            expect(groupConditions()).toEqual({
                OR: [{ main_group: 4 }, { main_group: -2 }],
            });
        });

        it("restreint au sous-groupe demandé sans perdre les cours communs", async () => {
            await getScheduleForGroup({ group: "G1", tp: "B" });

            expect(groupConditions()).toEqual({
                OR: [
                    { main_group: 1, sub_group: { in: [-1, 0, 2] } },
                    { main_group: -1 },
                ],
            });
        });
    });

    describe("fenêtre de la journée", () => {
        it("couvre la journée demandée de 00:00:00 à 23:59:59.999", async () => {
            await getScheduleForGroup({ group: "G1", date: "2026-09-07" });

            const { gte: startDate, lt: endDate } = lastQuery().where.start_datetime;
            expect(startDate.getHours()).toBe(0);
            expect(startDate.getMinutes()).toBe(0);
            expect(startDate.getSeconds()).toBe(0);
            expect(startDate.getMilliseconds()).toBe(0);
            expect(endDate.getHours()).toBe(23);
            expect(endDate.getMinutes()).toBe(59);
            expect(endDate.getSeconds()).toBe(59);
            expect(endDate.getMilliseconds()).toBe(999);
            expect(startDate.getDate()).toBe(endDate.getDate());
        });

        it("utilise la date du jour quand aucune date n'est fournie", async () => {
            const schedule = await getScheduleForGroup({ group: "G1" });

            expect(schedule.date).toBe(new Date().toISOString().split("T")[0]);
        });
    });

    describe("mise en forme des cours", () => {
        it("reprend le groupe et le TP demandés dans la réponse", async () => {
            const schedule = await getScheduleForGroup({ group: "G1", tp: "A" });

            expect(schedule.group).toBe("G1");
            expect(schedule.tp).toBe("A");
        });

        it("sérialise les dates et joint les salles", async () => {
            prismaEdtMock.lesson.findMany.mockResolvedValue([
                lessonFull({
                    lesson_room: [
                        { lesson_id: 1, room_id: 40, room: { id: 40, name: "S101" } },
                        { lesson_id: 1, room_id: 41, room: { id: 41, name: "S102" } },
                    ],
                } as any),
            ]);

            const [course] = (await getScheduleForGroup({ group: "G1" })).courses;

            expect(course).toEqual({
                id: 1,
                code: "R3.01",
                title: "Développement web",
                startTime: "2026-09-07T08:00:00.000Z",
                endTime: "2026-09-07T10:00:00.000Z",
                room: "S101, S102",
                teacher: "Hugel T.",
                type: "CM",
            });
        });

        it("affiche N/A quand le cours n'a aucune salle", async () => {
            prismaEdtMock.lesson.findMany.mockResolvedValue([
                lessonFull({ lesson_room: [] } as any),
            ]);

            const [course] = (await getScheduleForGroup({ group: "G1" })).courses;

            expect(course!.room).toBe("N/A");
        });

        it("laisse le professeur indéfini quand le cours n'en a pas", async () => {
            prismaEdtMock.lesson.findMany.mockResolvedValue([
                lessonFull({ teacher: null } as any),
            ]);

            const [course] = (await getScheduleForGroup({ group: "G1" })).courses;

            expect(course!.teacher).toBeUndefined();
        });

        it("comble un contenu manquant par des valeurs par défaut", async () => {
            prismaEdtMock.lesson.findMany.mockResolvedValue([
                lessonFull({ content: { id: 10, code: "", name: "" } } as any),
            ]);

            const [course] = (await getScheduleForGroup({ group: "G1" })).courses;

            expect(course!.code).toBe("");
            expect(course!.title).toBe("Cours");
        });

        it("retourne une liste vide quand la journée est libre", async () => {
            expect((await getScheduleForGroup({ group: "G1" })).courses).toEqual([]);
        });
    });

    describe("détection du type de cours", () => {
        async function typeOf(lesson: any) {
            resetPrismaMocks();
            prismaEdtMock.lesson.findMany.mockResolvedValue([lessonFull(lesson)]);
            const [course] = (await getScheduleForGroup({ group: "G1" })).courses;
            return course!.type;
        }

        it("privilégie le type porté par la leçon", async () => {
            expect(await typeOf({ type: "td" })).toBe("TD");
            expect(await typeOf({ type: "SAE" })).toBe("SAE");
            expect(await typeOf({ type: "EXAM" })).toBe("DS");
        });

        it("déduit le type du titre quand la leçon n'en porte pas", async () => {
            expect(await typeOf({
                type: "",
                content: { id: 10, code: "R1", name: "Amphi de rentrée" },
            })).toBe("CM");
            expect(await typeOf({
                type: "",
                content: { id: 10, code: "R1", name: "TP réseaux" },
            })).toBe("TP");
        });

        it("classe en « Autre » ce qu'il ne reconnaît pas", async () => {
            expect(await typeOf({
                type: "Réunion",
                content: { id: 10, code: "R1", name: "Point projet" },
            })).toBe("Autre");
        });
    });
});
