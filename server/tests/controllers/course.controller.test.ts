// ============================================
// 📁 tests/controllers/course.controller.test.ts
// ============================================

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

import { CourseController } from "../../src/controllers/course.controller.js";
import { CourseService } from "../../src/services/course.service.js";
import { createMockRequest, createMockResponse } from "../helpers/express-mock.js";

const COURSE = {
    code: "R3.01",
    title: "Développement web",
    type: "TP",
    rooms: ["S101"],
    groups: ["G1A"],
    teacher: "Hugel T.",
    start_at: "2026-09-07T08:00:00.000Z",
    end_at: "2026-09-07T10:00:00.000Z",
};

const PERIOD = {
    start_at: "2026-09-07T00:00:00.000Z",
    end_at: "2026-09-13T23:59:59.000Z",
};

let getCourses: ReturnType<typeof spyOn>;

describe("CourseController.getCourses", () => {
    beforeEach(() => {
        getCourses = spyOn(CourseService.instance, "getCourses").mockResolvedValue([]);
    });

    afterEach(() => {
        mock.restore();
    });

    it("répond 200 avec les cours trouvés", async () => {
        getCourses.mockResolvedValue([COURSE]);
        const res = createMockResponse();

        await CourseController.instance.getCourses(createMockRequest({ query: PERIOD }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true, data: [COURSE] });
    });

    it("transmet les filtres de la query string au service", async () => {
        const res = createMockResponse();
        const query = { ...PERIOD, groups: "G1A", rooms: "S101", teachers: "TH" };

        await CourseController.instance.getCourses(createMockRequest({ query }), res);

        expect(getCourses).toHaveBeenCalledWith({
            start_at: PERIOD.start_at,
            end_at: PERIOD.end_at,
            groups: "G1A",
            rooms: "S101",
            teachers: "TH",
        });
    });

    it("répond 400 quand start_at est absent", async () => {
        const res = createMockResponse();

        await CourseController.instance.getCourses(
            createMockRequest({ query: { end_at: PERIOD.end_at } }),
            res,
        );

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(getCourses).not.toHaveBeenCalled();
    });

    it("répond 400 quand end_at est absent", async () => {
        const res = createMockResponse();

        await CourseController.instance.getCourses(
            createMockRequest({ query: { start_at: PERIOD.start_at } }),
            res,
        );

        expect(res.statusCode).toBe(400);
        expect(getCourses).not.toHaveBeenCalled();
    });

    it("renvoie un tableau vide plutôt que null quand le service ne retourne rien", async () => {
        getCourses.mockResolvedValue(undefined as any);
        const res = createMockResponse();

        await CourseController.instance.getCourses(createMockRequest({ query: PERIOD }), res);

        expect(res.body).toEqual({ success: true, data: [] });
    });

    it("répond 500 quand le service échoue", async () => {
        getCourses.mockRejectedValue(new Error("BDD indisponible"));
        const res = createMockResponse();

        await CourseController.instance.getCourses(createMockRequest({ query: PERIOD }), res);

        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain("BDD indisponible");
    });
});
