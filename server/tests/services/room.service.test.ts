// ============================================
// 📁 tests/services/room.service.test.ts
// ============================================

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

import { RoomService } from "../../src/services/room.service.js";
import { RoomRepository } from "../../src/repository/room.repository.js";
import { lessonFull, roomWithLessons } from "../helpers/fixtures.js";

const START = new Date("2026-09-07T08:00:00.000Z");
const END = new Date("2026-09-07T10:00:00.000Z");

let findAll: ReturnType<typeof spyOn>;
let findInRange: ReturnType<typeof spyOn>;

describe("RoomService", () => {
    beforeEach(() => {
        findAll = spyOn(RoomRepository.instance, "findAll").mockResolvedValue([]);
        findInRange = spyOn(RoomRepository.instance, "findAllRoomsWithLessonsInTimeRange")
            .mockResolvedValue([]);
    });

    afterEach(() => {
        mock.restore();
    });

    describe("getAllRooms", () => {
        it("relaie les salles du repository", async () => {
            const rooms = [{ id: 40, name: "S101" }];
            findAll.mockResolvedValue(rooms);

            expect(await RoomService.instance.getAllRooms()).toBe(rooms as any);
        });
    });

    describe("getRoomsAvailability", () => {
        it("transmet la fenêtre horaire au repository", async () => {
            await RoomService.instance.getRoomsAvailability(START, END);

            expect(findInRange).toHaveBeenCalledWith(START, END);
        });

        it("transforme chaque salle et ses cours au format API", async () => {
            findInRange.mockResolvedValue([roomWithLessons()]);

            const [room] = await RoomService.instance.getRoomsAvailability(START, END);

            expect(room).toEqual({
                id: 40,
                name: "S101",
                lessons: [
                    {
                        id: 1,
                        type: "CM",
                        startTime: "2026-09-07T08:00:00.000Z",
                        endTime: "2026-09-07T10:00:00.000Z",
                        rooms: ["S101"],
                        teacher: "Hugel T.",
                        contentCode: "R3.01",
                        contentName: "Développement web",
                        groups: [{ mainGroup: 1, subGroup: 1 }],
                    },
                ],
            });
        });

        it("expose une salle libre avec une liste de cours vide", async () => {
            findInRange.mockResolvedValue([
                roomWithLessons({ id: 41, name: "S102", lesson_room: [] }),
            ]);

            const [room] = await RoomService.instance.getRoomsAvailability(START, END);

            expect(room).toEqual({ id: 41, name: "S102", lessons: [] });
        });

        it("liste toutes les salles d'un cours partagé entre plusieurs salles", async () => {
            findInRange.mockResolvedValue([
                roomWithLessons({
                    lesson_room: [
                        {
                            lesson_id: 1,
                            room_id: 40,
                            lesson: lessonFull({
                                lesson_room: [
                                    { lesson_id: 1, room_id: 40, room: { id: 40, name: "S101" } },
                                    { lesson_id: 1, room_id: 41, room: { id: 41, name: "S102" } },
                                ],
                            } as any),
                        } as any,
                    ],
                }),
            ]);

            const [room] = await RoomService.instance.getRoomsAvailability(START, END);

            expect(room!.lessons[0]!.rooms).toEqual(["S101", "S102"]);
        });

        it("met le professeur à null quand le cours n'en a pas", async () => {
            findInRange.mockResolvedValue([
                roomWithLessons({
                    lesson_room: [
                        {
                            lesson_id: 1,
                            room_id: 40,
                            lesson: lessonFull({ teacher: null } as any),
                        } as any,
                    ],
                }),
            ]);

            const [room] = await RoomService.instance.getRoomsAvailability(START, END);

            expect(room!.lessons[0]!.teacher).toBeNull();
        });

        it("retourne une liste vide si le repository ne renvoie rien", async () => {
            findInRange.mockResolvedValue(null);

            expect(await RoomService.instance.getRoomsAvailability(START, END)).toEqual([]);
        });
    });
});
