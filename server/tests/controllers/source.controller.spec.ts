// ============================================
// 📁 tests/controllers/source.controller.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { SourceController } from "../../src/controllers/source.controller.js";
import { SourceService } from "../../src/services/source.service.js";
import { fakeRequest, fakeResponse } from "../helpers/http.js";

describe("SourceController", () => {
    const getWeekSources = spyOn(SourceService.instance, "getWeekSources");
    const error = spyOn(console, "error");

    const semaine = { weekNumber: 2, files: [] };
    const requête = (query: Record<string, unknown>) => fakeRequest({ query: query as never });

    beforeEach(() => {
        getWeekSources.mockClear();
        error.mockClear();
        error.mockImplementation(() => {});
        getWeekSources.mockResolvedValue(semaine);
    });

    afterAll(() => {
        getWeekSources.mockRestore();
        error.mockRestore();
    });

    describe("getWeek", () => {
        it("rend les documents de la semaine", async () => {
            const { res, code, body } = fakeResponse();
            await SourceController.instance.getWeek(requête({ group: "G8a", start_at: "2026-09-06T22:00:00.000Z" }), res);

            expect(code()).toBe(200);
            expect(body()).toEqual({ success: true, data: semaine });
            expect(getWeekSources).toHaveBeenCalledWith("G8a", new Date("2026-09-06T22:00:00.000Z"));
        });

        it("refuse un groupe absent", async () => {
            const { res, code } = fakeResponse();
            await SourceController.instance.getWeek(requête({ start_at: "2026-09-06T22:00:00.000Z" }), res);

            expect(code()).toBe(400);
            expect(getWeekSources).not.toHaveBeenCalled();
        });

        it("refuse ce qui n'est pas un code de groupe", async () => {
            const { res, code } = fakeResponse();
            await SourceController.instance.getWeek(requête({ group: "A3", start_at: "2026-09-06T22:00:00.000Z" }), res);

            expect(code()).toBe(400);
        });

        it("refuse un groupe passé en tableau", async () => {
            // `?group=G8a&group=G8b` : Express rend alors un tableau.
            const { res, code } = fakeResponse();
            await SourceController.instance.getWeek(requête({ group: ["G8a", "G8b"], start_at: "2026-09-06T22:00:00.000Z" }), res);

            expect(code()).toBe(400);
        });

        it("refuse une date absente", async () => {
            const { res, code } = fakeResponse();
            await SourceController.instance.getWeek(requête({ group: "G8a" }), res);

            expect(code()).toBe(400);
        });

        it("refuse une date illisible", async () => {
            const { res, code } = fakeResponse();
            await SourceController.instance.getWeek(requête({ group: "G8a", start_at: "hier" }), res);

            expect(code()).toBe(400);
            expect(getWeekSources).not.toHaveBeenCalled();
        });

        it("répond 404 pour un groupe inconnu", async () => {
            getWeekSources.mockResolvedValue(null);

            const { res, code, body } = fakeResponse();
            await SourceController.instance.getWeek(requête({ group: "G99z", start_at: "2026-09-06T22:00:00.000Z" }), res);

            expect(code()).toBe(404);
            expect(body()).toMatchObject({ success: false });
        });

        it("répond 500 quand le service échoue", async () => {
            getWeekSources.mockRejectedValue(new Error("base injoignable"));

            const { res, code } = fakeResponse();
            await SourceController.instance.getWeek(requête({ group: "G8a", start_at: "2026-09-06T22:00:00.000Z" }), res);

            expect(code()).toBe(500);
            expect(error).toHaveBeenCalled();
        });
    });
});
