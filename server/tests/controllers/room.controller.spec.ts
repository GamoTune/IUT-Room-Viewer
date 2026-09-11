// ============================================
// 📁 tests/controllers/room.controller.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { RoomController } from "../../src/controllers/room.controller.js";
import { RoomService } from "../../src/services/room.service.js";
import { fakeRequest, fakeResponse } from "../helpers/http.js";

describe("RoomController", () => {
    const getAllRooms = spyOn(RoomService.instance, "getAllRooms");
    const getRoomsAvailability = spyOn(RoomService.instance, "getRoomsAvailability");

    beforeEach(() => {
        getAllRooms.mockClear();
        getRoomsAvailability.mockClear();
        getAllRooms.mockResolvedValue([]);
        getRoomsAvailability.mockResolvedValue([]);
    });

    afterAll(() => {
        getAllRooms.mockRestore();
        getRoomsAvailability.mockRestore();
    });

    describe("getAll", () => {
        it("rend le référentiel", async () => {
            const salles = [{ id: 1, name: "R46" }];
            getAllRooms.mockResolvedValue(salles as never);

            const { res, code, body } = fakeResponse();
            await RoomController.instance.getAll(fakeRequest(), res);

            expect(code()).toBe(200);
            expect(body()).toEqual({ success: true, data: salles });
        });

        it("rend une liste vide plutôt que rien quand le service ne rend rien", async () => {
            getAllRooms.mockResolvedValue(undefined as never);

            const { res, body } = fakeResponse();
            await RoomController.instance.getAll(fakeRequest(), res);

            expect(body()).toEqual({ success: true, data: [] });
        });

        it("répond 500 quand le service échoue", async () => {
            getAllRooms.mockRejectedValue(new Error("base injoignable"));

            const { res, code } = fakeResponse();
            await RoomController.instance.getAll(fakeRequest(), res);

            expect(code()).toBe(500);
        });
    });

    describe("getRoomAvailability", () => {
        const query = { startTime: "2026-09-10T06:00:00.000Z", endTime: "2026-09-10T08:00:00.000Z" };

        it("transmet la fenêtre au service", async () => {
            const { res, code } = fakeResponse();
            await RoomController.instance.getRoomAvailability(fakeRequest({ query }), res);

            expect(code()).toBe(200);
            expect(getRoomsAvailability).toHaveBeenCalledWith(new Date(query.startTime), new Date(query.endTime));
        });

        it("refuse une requête sans borne de début", async () => {
            const { res, code, body } = fakeResponse();
            await RoomController.instance.getRoomAvailability(fakeRequest({ query: { endTime: query.endTime } }), res);

            expect(code()).toBe(400);
            expect(body()).toMatchObject({ success: false });
            expect(getRoomsAvailability).not.toHaveBeenCalled();
        });

        it("refuse une requête sans borne de fin", async () => {
            const { res, code } = fakeResponse();
            await RoomController.instance.getRoomAvailability(
                fakeRequest({ query: { startTime: query.startTime } }),
                res,
            );

            expect(code()).toBe(400);
        });

        it("répond 500 quand le service échoue", async () => {
            getRoomsAvailability.mockRejectedValue(new Error("base injoignable"));

            const { res, code } = fakeResponse();
            await RoomController.instance.getRoomAvailability(fakeRequest({ query }), res);

            expect(code()).toBe(500);
        });
    });
});
