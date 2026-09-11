// ============================================
// 📁 tests/services/room.service.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import lessonRepository from "../../src/repository/lesson.repository.js";
import { RoomService } from "../../src/services/room.service.js";
import { census, lesson } from "../helpers/fixtures.js";

describe("RoomService", () => {
    const findAllRooms = spyOn(lessonRepository, "findAllRooms");
    const findMany = spyOn(lessonRepository, "findMany");
    const loadGroupCensus = spyOn(lessonRepository, "loadGroupCensus");

    beforeEach(() => {
        findAllRooms.mockClear();
        findMany.mockClear();
        loadGroupCensus.mockClear();
        loadGroupCensus.mockResolvedValue(census);
    });

    afterAll(() => {
        findAllRooms.mockRestore();
        findMany.mockRestore();
        loadGroupCensus.mockRestore();
    });

    describe("getAllRooms", () => {
        it("rend le référentiel tel que le repository l'ordonne", async () => {
            const salles = [{ id: 1, name: "R46" }];
            findAllRooms.mockResolvedValue(salles as never);

            expect(await RoomService.instance.getAllRooms()).toBe(salles as never);
        });
    });

    describe("getRoomsAvailability", () => {
        const debut = new Date("2026-09-10T06:00:00.000Z");
        const fin = new Date("2026-09-10T08:00:00.000Z");

        it("rattache chaque cours à sa salle", async () => {
            findAllRooms.mockResolvedValue([{ id: 1, name: "R52" }] as never);
            findMany.mockResolvedValue([lesson({ rooms: ["R52"] })]);

            const salles = await RoomService.instance.getRoomsAvailability(debut, fin);

            expect(salles).toHaveLength(1);
            expect(salles[0]!.lessons).toHaveLength(1);
            expect(salles[0]!.lessons[0]!.contentCode).toBe("R5A.14");
        });

        it("rend aussi les salles libres : une salle vide est une information", async () => {
            findAllRooms.mockResolvedValue([
                { id: 1, name: "R52" },
                { id: 2, name: "R46" },
            ] as never);
            findMany.mockResolvedValue([lesson({ rooms: ["R52"] })]);

            const salles = await RoomService.instance.getRoomsAvailability(debut, fin);

            expect(salles.map((s) => [s.name, s.lessons.length])).toEqual([
                ["R52", 1],
                ["R46", 0],
            ]);
        });

        it("compte un cours dans chacune de ses salles", async () => {
            // Un cours peut occuper deux salles à la fois (`108-9`).
            findAllRooms.mockResolvedValue([
                { id: 1, name: "108" },
                { id: 2, name: "109" },
            ] as never);
            findMany.mockResolvedValue([lesson({ rooms: ["108", "109"] })]);

            const salles = await RoomService.instance.getRoomsAvailability(debut, fin);
            expect(salles.every((s) => s.lessons.length === 1)).toBe(true);
        });

        it("empile plusieurs cours dans une même salle", async () => {
            findAllRooms.mockResolvedValue([{ id: 1, name: "R52" }] as never);
            findMany.mockResolvedValue([
                lesson({ id: 1, rooms: ["R52"] }),
                lesson({ id: 2, rooms: ["R52"] }),
            ]);

            const salles = await RoomService.instance.getRoomsAvailability(debut, fin);
            expect(salles[0]!.lessons.map((l) => l.id)).toEqual([1, 2]);
        });

        it("ignore un cours dont les salles ne sont pas chargées", async () => {
            findAllRooms.mockResolvedValue([{ id: 1, name: "R52" }] as never);
            findMany.mockResolvedValue([lesson({ rooms: [] })]);

            const salles = await RoomService.instance.getRoomsAvailability(debut, fin);
            expect(salles[0]!.lessons).toEqual([]);
        });

        it("interroge la fenêtre en mode chevauchement", async () => {
            findAllRooms.mockResolvedValue([] as never);
            findMany.mockResolvedValue([]);

            await RoomService.instance.getRoomsAvailability(debut, fin);

            expect(findMany).toHaveBeenCalledWith({ from: debut, to: fin, mode: "overlap" });
        });
    });
});
