// ============================================
// 📁 tests/controllers/sync.controller.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { SyncController } from "../../src/controllers/sync.controller.js";
import syncService from "../../src/sync/sync.service.js";
import { fakeRequest, fakeResponse } from "../helpers/http.js";

describe("SyncController", () => {
    const syncAll = spyOn(syncService, "syncAll");
    const getStatus = spyOn(syncService, "getStatus");
    const error = spyOn(console, "error");

    const bilan = { success: true, documents: 9, created: 0 };
    const repos = { isRunning: false, lastRun: null };

    beforeEach(() => {
        syncAll.mockClear();
        getStatus.mockClear();
        error.mockClear();
        error.mockImplementation(() => {});
        syncAll.mockResolvedValue(bilan as never);
        getStatus.mockReturnValue(repos as never);
    });

    afterAll(() => {
        syncAll.mockRestore();
        getStatus.mockRestore();
        error.mockRestore();
    });

    describe("triggerSync", () => {
        it("lance la synchronisation et rend son bilan", async () => {
            const { res, code, body } = fakeResponse();
            await SyncController.instance.triggerSync(fakeRequest(), res);

            expect(code()).toBe(200);
            expect(body()).toEqual({ success: true, data: bilan });
            expect(syncAll).toHaveBeenCalledWith({ archiveOthers: true });
        });

        it("refuse une seconde synchronisation simultanée", async () => {
            getStatus.mockReturnValue({ isRunning: true } as never);

            const { res, code, body } = fakeResponse();
            await SyncController.instance.triggerSync(fakeRequest(), res);

            expect(code()).toBe(409);
            expect(body()).toMatchObject({ success: false });
            expect(syncAll).not.toHaveBeenCalled();
        });

        it("reporte l'échec de la synchronisation sans masquer le bilan", async () => {
            syncAll.mockResolvedValue({ ...bilan, success: false } as never);

            const { res, body } = fakeResponse();
            await SyncController.instance.triggerSync(fakeRequest(), res);

            expect(body()).toMatchObject({ success: false });
        });

        it("répond 500 quand la synchronisation lève", async () => {
            syncAll.mockRejectedValue(new Error("réseau"));

            const { res, code } = fakeResponse();
            await SyncController.instance.triggerSync(fakeRequest(), res);

            expect(code()).toBe(500);
            expect(error).toHaveBeenCalled();
        });
    });

    describe("resetSync", () => {
        it("reprend tout en ignorant les en-têtes de cache", async () => {
            const { res, code } = fakeResponse();
            await SyncController.instance.resetSync(fakeRequest(), res);

            expect(code()).toBe(200);
            expect(syncAll).toHaveBeenCalledWith({ force: true, archiveOthers: true });
        });

        it("répond 500 quand la reprise lève", async () => {
            syncAll.mockRejectedValue(new Error("réseau"));

            const { res, code } = fakeResponse();
            await SyncController.instance.resetSync(fakeRequest(), res);

            expect(code()).toBe(500);
        });
    });

    describe("getStatus", () => {
        it("rend l'état courant", async () => {
            const { res, code, body } = fakeResponse();
            await SyncController.instance.getStatus(fakeRequest(), res);

            expect(code()).toBe(200);
            expect(body()).toEqual({ success: true, data: repos });
        });

        it("répond 500 quand l'état est illisible", async () => {
            getStatus.mockImplementation(() => {
                throw new Error("état corrompu");
            });

            const { res, code } = fakeResponse();
            await SyncController.instance.getStatus(fakeRequest(), res);

            expect(code()).toBe(500);
        });
    });
});
