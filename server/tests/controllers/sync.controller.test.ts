// ============================================
// 📁 tests/controllers/sync.controller.test.ts
// ============================================

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

import { SyncController } from "../../src/controllers/sync.controller.js";
import { SyncService } from "../../src/services/sync.service.js";
import { createMockRequest, createMockResponse } from "../helpers/express-mock.js";

const IDLE = { isRunning: false, lastSync: null };

const SUMMARY = {
    success: true,
    startedAt: new Date("2026-09-07T08:00:00.000Z"),
    completedAt: new Date("2026-09-07T08:01:00.000Z"),
    totalEdtProcessed: 3,
    totalEdtSkipped: 1,
    totalLessonsProcessed: 120,
    errors: [],
};

let getStatus: ReturnType<typeof spyOn>;
let syncAll: ReturnType<typeof spyOn>;
let reset: ReturnType<typeof spyOn>;

describe("SyncController", () => {
    beforeEach(() => {
        getStatus = spyOn(SyncService.instance, "getStatus").mockReturnValue(IDLE as any);
        syncAll = spyOn(SyncService.instance, "syncAll").mockResolvedValue(SUMMARY as any);
        reset = spyOn(SyncService.instance, "reset").mockResolvedValue(12);
        spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        mock.restore();
    });

    describe("triggerSync", () => {
        it("lance la synchronisation et répond 200 avec le bilan", async () => {
            const res = createMockResponse();

            await SyncController.instance.triggerSync(createMockRequest(), res);

            expect(syncAll).toHaveBeenCalledTimes(1);
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ success: true, data: SUMMARY });
        });

        it("reflète l'échec du bilan dans le champ success", async () => {
            syncAll.mockResolvedValue({ ...SUMMARY, success: false, errors: ["A1 KO"] } as any);
            const res = createMockResponse();

            await SyncController.instance.triggerSync(createMockRequest(), res);

            expect(res.body.success).toBe(false);
        });

        it("répond 409 si une synchronisation est déjà en cours", async () => {
            getStatus.mockReturnValue({ isRunning: true, lastSync: null } as any);
            const res = createMockResponse();

            await SyncController.instance.triggerSync(createMockRequest(), res);

            expect(res.statusCode).toBe(409);
            expect(res.body.success).toBe(false);
            expect(syncAll).not.toHaveBeenCalled();
        });

        it("répond 500 quand la synchronisation échoue", async () => {
            syncAll.mockRejectedValue(new Error("Unilim injoignable"));
            const res = createMockResponse();

            await SyncController.instance.triggerSync(createMockRequest(), res);

            expect(res.statusCode).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });

    describe("resetSync", () => {
        it("répond 200 avec le nombre d'EDT supprimés", async () => {
            const res = createMockResponse();

            await SyncController.instance.resetSync(createMockRequest(), res);

            expect(reset).toHaveBeenCalledTimes(1);
            expect(res.body).toEqual({ success: true, data: { deletedEdts: 12 } });
        });

        it("répond 500 quand la suppression échoue", async () => {
            reset.mockRejectedValue(new Error("boom"));
            const res = createMockResponse();

            await SyncController.instance.resetSync(createMockRequest(), res);

            expect(res.statusCode).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });

    describe("getStatus", () => {
        it("expose le statut du service", async () => {
            const status = { isRunning: true, lastSync: SUMMARY };
            getStatus.mockReturnValue(status as any);
            const res = createMockResponse();

            await SyncController.instance.getStatus(createMockRequest(), res);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ success: true, data: status });
        });

        it("répond 500 quand la lecture du statut échoue", async () => {
            getStatus.mockImplementation(() => {
                throw new Error("boom");
            });
            const res = createMockResponse();

            await SyncController.instance.getStatus(createMockRequest(), res);

            expect(res.statusCode).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
});
