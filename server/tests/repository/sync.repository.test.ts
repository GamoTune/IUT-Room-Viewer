// ============================================
// 📁 tests/repository/sync.repository.test.ts
// ============================================

import { beforeEach, describe, expect, it } from "bun:test";

import { SyncRepository } from "../../src/repository/sync.repository.js";
import { prismaEdtMock, resetPrismaMocks } from "../helpers/prisma-mock.js";

const EDT = {
    weekNumber: 37,
    fromYear: "A1",
    link: "https://example.test/edt-37.ics",
    lastUpdated: new Date("2026-09-01T12:00:00.000Z"),
};

describe("SyncRepository", () => {
    beforeEach(() => {
        resetPrismaMocks();
    });

    describe("findEdtByWeekAndYear", () => {
        it("cherche l'EDT sur le couple semaine / année", async () => {
            await SyncRepository.instance.findEdtByWeekAndYear(37, "A1");

            expect(prismaEdtMock.edt_index.findFirst).toHaveBeenCalledWith({
                where: { week_number: 37, from_year: "A1" },
            });
        });
    });

    describe("deleteAllEdts", () => {
        it("retourne le nombre d'EDT supprimés", async () => {
            prismaEdtMock.edt_index.deleteMany.mockResolvedValue({ count: 12 });

            expect(await SyncRepository.instance.deleteAllEdts()).toBe(12);
            expect(prismaEdtMock.edt_index.deleteMany).toHaveBeenCalledWith({});
        });
    });

    describe("upsertEdt", () => {
        it("crée l'EDT quand la semaine est inconnue", async () => {
            prismaEdtMock.edt_index.findFirst.mockResolvedValue(null);

            await SyncRepository.instance.upsertEdt(EDT);

            expect(prismaEdtMock.edt_index.create).toHaveBeenCalledWith({
                data: {
                    week_number: 37,
                    from_year: "A1",
                    link: EDT.link,
                    last_updated: EDT.lastUpdated,
                },
            });
            expect(prismaEdtMock.edt_index.update).not.toHaveBeenCalled();
        });

        it("met à jour le lien et la date quand la semaine existe déjà", async () => {
            prismaEdtMock.edt_index.findFirst.mockResolvedValue({ id: 5 });

            await SyncRepository.instance.upsertEdt(EDT);

            expect(prismaEdtMock.edt_index.update).toHaveBeenCalledWith({
                where: { id: 5 },
                data: { link: EDT.link, last_updated: EDT.lastUpdated },
            });
            expect(prismaEdtMock.edt_index.create).not.toHaveBeenCalled();
        });
    });

    describe("upsertLesson", () => {
        const lesson = {
            type: "TP",
            startDatetime: new Date("2026-09-07T08:00:00.000Z"),
            endDatetime: new Date("2026-09-07T10:00:00.000Z"),
            contentId: 10,
            teacherId: 20,
            edtId: 30,
        };

        it("réutilise le cours identique déjà enregistré", async () => {
            const existing = { id: 99 };
            prismaEdtMock.lesson.findFirst.mockResolvedValue(existing);

            expect(await SyncRepository.instance.upsertLesson(lesson)).toBe(existing as any);
            expect(prismaEdtMock.lesson.create).not.toHaveBeenCalled();
        });

        it("crée le cours quand aucun équivalent n'existe", async () => {
            prismaEdtMock.lesson.findFirst.mockResolvedValue(null);

            await SyncRepository.instance.upsertLesson(lesson);

            expect(prismaEdtMock.lesson.create).toHaveBeenCalledWith({
                data: {
                    type: "TP",
                    start_datetime: lesson.startDatetime,
                    end_datetime: lesson.endDatetime,
                    content_id: 10,
                    teacher_id: 20,
                    edt_id: 30,
                },
            });
        });
    });

    describe("upserts de référentiel", () => {
        it("met à jour le libellé d'une matière sans changer son code", async () => {
            await SyncRepository.instance.upsertContent("R3.01", "Développement web");

            expect(prismaEdtMock.content.upsert).toHaveBeenCalledWith({
                where: { code: "R3.01" },
                update: { name: "Développement web" },
                create: { code: "R3.01", name: "Développement web" },
            });
        });

        it("crée un professeur sans écraser l'existant", async () => {
            await SyncRepository.instance.upsertTeacher("Hugel T.");

            expect(prismaEdtMock.teacher.upsert).toHaveBeenCalledWith({
                where: { name: "Hugel T." },
                update: {},
                create: { name: "Hugel T." },
            });
        });

        it("crée une salle sans écraser l'existante", async () => {
            await SyncRepository.instance.upsertRoom("S101");

            expect(prismaEdtMock.room.upsert).toHaveBeenCalledWith({
                where: { name: "S101" },
                update: {},
                create: { name: "S101" },
            });
        });

        it("identifie un groupe par la clé composite groupe / sous-groupe", async () => {
            await SyncRepository.instance.upsertStudentGroup(1, 2);

            expect(prismaEdtMock.student_group.upsert).toHaveBeenCalledWith({
                where: { main_group_sub_group: { main_group: 1, sub_group: 2 } },
                update: {},
                create: { main_group: 1, sub_group: 2 },
            });
        });
    });

    describe("liaisons", () => {
        it("lie un cours à un groupe de façon idempotente", async () => {
            await SyncRepository.instance.linkLessonToGroup(1, 50);

            expect(prismaEdtMock.lesson_group.upsert).toHaveBeenCalledWith({
                where: { lesson_id_group_id: { lesson_id: 1, group_id: 50 } },
                update: {},
                create: { lesson_id: 1, group_id: 50 },
            });
        });

        it("lie un cours à une salle de façon idempotente", async () => {
            await SyncRepository.instance.linkLessonToRoom(1, 40);

            expect(prismaEdtMock.lesson_room.upsert).toHaveBeenCalledWith({
                where: { lesson_id_room_id: { lesson_id: 1, room_id: 40 } },
                update: {},
                create: { lesson_id: 1, room_id: 40 },
            });
        });
    });

    describe("deleteLessonsByEdtId", () => {
        it("supprime les cours d'un EDT et retourne leur nombre", async () => {
            prismaEdtMock.lesson.deleteMany.mockResolvedValue({ count: 42 });

            expect(await SyncRepository.instance.deleteLessonsByEdtId(30)).toBe(42);
            expect(prismaEdtMock.lesson.deleteMany).toHaveBeenCalledWith({
                where: { edt_id: 30 },
            });
        });
    });
});
