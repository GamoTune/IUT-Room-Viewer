// ============================================
// 📁 tests/controllers/course.controller.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { CourseController } from "../../src/controllers/course.controller.js";
import { CourseService } from "../../src/services/course.service.js";
import { fakeRequest, fakeResponse } from "../helpers/http.js";

describe("CourseController", () => {
    const getCourses = spyOn(CourseService.instance, "getCourses");

    const query = { start_at: "2026-09-07T00:00:00.000Z", end_at: "2026-09-14T00:00:00.000Z" };

    beforeEach(() => {
        getCourses.mockClear();
        getCourses.mockResolvedValue([]);
    });

    afterAll(() => {
        getCourses.mockRestore();
    });

    describe("getCourses", () => {
        it("rend les cours du service", async () => {
            const cours = [{ code: "R5A.14" }];
            getCourses.mockResolvedValue(cours as never);

            const { res, code, body } = fakeResponse();
            await CourseController.instance.getCourses(fakeRequest({ query }), res);

            expect(code()).toBe(200);
            expect(body()).toEqual({ success: true, data: cours });
        });

        it("transmet les filtres facultatifs", async () => {
            const { res } = fakeResponse();
            await CourseController.instance.getCourses(
                fakeRequest({ query: { ...query, groups: "G8a", rooms: "R52", teachers: "JP" } }),
                res,
            );

            expect(getCourses).toHaveBeenCalledWith({
                ...query,
                groups: "G8a",
                rooms: "R52",
                teachers: "JP",
            });
        });

        it("rend une liste vide plutôt que rien", async () => {
            getCourses.mockResolvedValue(undefined as never);

            const { res, body } = fakeResponse();
            await CourseController.instance.getCourses(fakeRequest({ query }), res);

            expect(body()).toEqual({ success: true, data: [] });
        });

        it("refuse une requête sans borne de début", async () => {
            const { res, code, body } = fakeResponse();
            await CourseController.instance.getCourses(fakeRequest({ query: { end_at: query.end_at } }), res);

            expect(code()).toBe(400);
            expect(body()).toMatchObject({ success: false });
            expect(getCourses).not.toHaveBeenCalled();
        });

        it("refuse une requête sans borne de fin", async () => {
            const { res, code } = fakeResponse();
            await CourseController.instance.getCourses(fakeRequest({ query: { start_at: query.start_at } }), res);

            expect(code()).toBe(400);
        });

        it("répond 500 quand le service échoue", async () => {
            getCourses.mockRejectedValue(new Error("base injoignable"));

            const { res, code } = fakeResponse();
            await CourseController.instance.getCourses(fakeRequest({ query }), res);

            expect(code()).toBe(500);
        });
    });
});
