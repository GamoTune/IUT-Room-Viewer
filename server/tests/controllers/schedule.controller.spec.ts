// ============================================
// 📁 tests/controllers/schedule.controller.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { getSchedule } from "../../src/controllers/schedule.controller.js";
import * as scheduleService from "../../src/services/schedule.service.js";
import { fakeRequest, fakeResponse } from "../helpers/http.js";

describe("getSchedule", () => {
    const getScheduleForGroup = spyOn(scheduleService, "getScheduleForGroup");
    const error = spyOn(console, "error");

    beforeEach(() => {
        getScheduleForGroup.mockClear();
        error.mockClear();
        error.mockImplementation(() => {});
        getScheduleForGroup.mockResolvedValue({ group: "G8", year: "BUT3", date: "2026-09-10", courses: [] });
    });

    afterAll(() => {
        getScheduleForGroup.mockRestore();
        error.mockRestore();
    });

    it("rend l'emploi du temps du groupe", async () => {
        const { res, code, body } = fakeResponse();
        await getSchedule(fakeRequest({ query: { group: "G8" } }), res);

        expect(code()).toBe(200);
        expect(body()).toMatchObject({ success: true });
    });

    it("transmet le sous-groupe et la date", async () => {
        const { res } = fakeResponse();
        await getSchedule(fakeRequest({ query: { group: "G8", tp: "a", date: "2026-09-10" } }), res);

        expect(getScheduleForGroup).toHaveBeenCalledWith({ group: "G8", tp: "a", date: "2026-09-10" });
    });

    it("laisse indéfinis les paramètres qui ne sont pas des chaînes", async () => {
        const { res } = fakeResponse();
        await getSchedule(fakeRequest({ query: { group: "G8", tp: ["a"], date: ["x"] } as never }), res);

        expect(getScheduleForGroup).toHaveBeenCalledWith({ group: "G8", tp: undefined, date: undefined });
    });

    it("refuse une requête sans groupe", async () => {
        const { res, code, body } = fakeResponse();
        await getSchedule(fakeRequest({ query: {} }), res);

        expect(code()).toBe(400);
        expect(body()).toMatchObject({ success: false });
        expect(getScheduleForGroup).not.toHaveBeenCalled();
    });

    it("refuse un groupe qui n'est pas une chaîne", async () => {
        const { res, code } = fakeResponse();
        await getSchedule(fakeRequest({ query: { group: ["G8"] } as never }), res);

        expect(code()).toBe(400);
    });

    it("répond 500 quand le service échoue", async () => {
        getScheduleForGroup.mockRejectedValue(new Error("base injoignable"));

        const { res, code } = fakeResponse();
        await getSchedule(fakeRequest({ query: { group: "G8" } }), res);

        expect(code()).toBe(500);
        expect(error).toHaveBeenCalled();
    });
});
