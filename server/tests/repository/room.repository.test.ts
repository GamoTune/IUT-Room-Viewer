// ============================================
// 📁 tests/repository/room.repository.test.ts
// ============================================

import { beforeEach, describe, expect, it } from "bun:test";

import { RoomRepository } from "../../src/repository/room.repository.js";
import { prismaEdtMock, resetPrismaMocks } from "../helpers/prisma-mock.js";
import { roomWithLessons } from "../helpers/fixtures.js";

describe("RoomRepository", () => {
    beforeEach(() => {
        resetPrismaMocks();
    });

    it("findAll trie les salles par nom", async () => {
        prismaEdtMock.room.findMany.mockResolvedValue([{ id: 1, name: "S101" }]);

        const rooms = await RoomRepository.instance.findAll();

        expect(prismaEdtMock.room.findMany).toHaveBeenCalledWith({
            orderBy: { name: "asc" },
        });
        expect(rooms).toEqual([{ id: 1, name: "S101" }]);
    });

    it("findByName interroge la salle par son nom unique", async () => {
        prismaEdtMock.room.findUnique.mockResolvedValue({ id: 1, name: "S101" });

        const room = await RoomRepository.instance.findByName("S101");

        expect(prismaEdtMock.room.findUnique).toHaveBeenCalledWith({
            where: { name: "S101" },
        });
        expect(room).toEqual({ id: 1, name: "S101" });
    });

    it("findByName renvoie null pour une salle inconnue", async () => {
        prismaEdtMock.room.findUnique.mockResolvedValue(null);

        expect(await RoomRepository.instance.findByName("INCONNUE")).toBeNull();
    });

    describe("findAllRoomsWithLessonsInTimeRange", () => {
        const start = new Date("2026-09-07T08:00:00.000Z");
        const end = new Date("2026-09-07T10:00:00.000Z");

        it("retient les cours qui chevauchent la fenêtre, bornes exclues", async () => {
            await RoomRepository.instance.findAllRoomsWithLessonsInTimeRange(start, end);

            const arg: any = prismaEdtMock.room.findMany.mock.calls[0]?.[0];
            // Un cours qui se termine pile au début de la fenêtre (ou commence
            // pile à sa fin) n'occupe pas la salle : d'où lt / gt et non lte / gte.
            expect(arg.include.lesson_room.where.lesson).toEqual({
                start_datetime: { lt: end },
                end_datetime: { gt: start },
            });
        });

        it("retourne toutes les salles, y compris celles sans cours", async () => {
            const rooms = [
                roomWithLessons(),
                roomWithLessons({ id: 41, name: "S102", lesson_room: [] }),
            ];
            prismaEdtMock.room.findMany.mockResolvedValue(rooms);

            const result = await RoomRepository.instance.findAllRoomsWithLessonsInTimeRange(start, end);

            expect(result).toHaveLength(2);
            const arg: any = prismaEdtMock.room.findMany.mock.calls[0]?.[0];
            expect(arg.orderBy).toEqual({ name: "asc" });
            expect(arg.where).toBeUndefined();
        });
    });
});
