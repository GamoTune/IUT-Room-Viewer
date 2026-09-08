// ============================================
// 📁 tests/controllers/room.controller.test.ts
// ============================================

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

import { RoomController } from "../../src/controllers/room.controller.js";
import { RoomService } from "../../src/services/room.service.js";
import { createMockRequest, createMockResponse } from "../helpers/express-mock.js";

const RANGE = {
    startTime: "2026-09-07T08:00:00.000Z",
    endTime: "2026-09-07T10:00:00.000Z",
};

let getAllRooms: ReturnType<typeof spyOn>;
let getRoomsAvailability: ReturnType<typeof spyOn>;

describe("RoomController", () => {
    beforeEach(() => {
        getAllRooms = spyOn(RoomService.instance, "getAllRooms").mockResolvedValue([]);
        getRoomsAvailability = spyOn(RoomService.instance, "getRoomsAvailability")
            .mockResolvedValue([]);
    });

    afterEach(() => {
        mock.restore();
    });

    describe("getAll", () => {
        it("répond 200 avec la liste des salles", async () => {
            getAllRooms.mockResolvedValue([{ id: 40, name: "S101" }]);
            const res = createMockResponse();

            await RoomController.instance.getAll(createMockRequest(), res);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ success: true, data: [{ id: 40, name: "S101" }] });
        });

        it("renvoie un tableau vide plutôt que null", async () => {
            getAllRooms.mockResolvedValue(null as any);
            const res = createMockResponse();

            await RoomController.instance.getAll(createMockRequest(), res);

            expect(res.body).toEqual({ success: true, data: [] });
        });

        it("répond 500 quand le service échoue", async () => {
            getAllRooms.mockRejectedValue(new Error("boom"));
            const res = createMockResponse();

            await RoomController.instance.getAll(createMockRequest(), res);

            expect(res.statusCode).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });

    describe("getRoomAvailability", () => {
        it("convertit les paramètres en dates avant d'appeler le service", async () => {
            const res = createMockResponse();

            await RoomController.instance.getRoomAvailability(
                createMockRequest({ query: RANGE }),
                res,
            );

            expect(getRoomsAvailability).toHaveBeenCalledWith(
                new Date(RANGE.startTime),
                new Date(RANGE.endTime),
            );
            expect(res.statusCode).toBe(200);
        });

        it("répond 400 quand startTime est absent", async () => {
            const res = createMockResponse();

            await RoomController.instance.getRoomAvailability(
                createMockRequest({ query: { endTime: RANGE.endTime } }),
                res,
            );

            expect(res.statusCode).toBe(400);
            expect(getRoomsAvailability).not.toHaveBeenCalled();
        });

        it("répond 400 quand endTime est absent", async () => {
            const res = createMockResponse();

            await RoomController.instance.getRoomAvailability(
                createMockRequest({ query: { startTime: RANGE.startTime } }),
                res,
            );

            expect(res.statusCode).toBe(400);
            expect(getRoomsAvailability).not.toHaveBeenCalled();
        });

        it("répond 500 quand le service échoue", async () => {
            getRoomsAvailability.mockRejectedValue(new Error("boom"));
            const res = createMockResponse();

            await RoomController.instance.getRoomAvailability(
                createMockRequest({ query: RANGE }),
                res,
            );

            expect(res.statusCode).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
});
