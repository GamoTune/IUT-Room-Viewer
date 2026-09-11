// ============================================
// 📁 tests/controllers/group.controller.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { GroupController } from "../../src/controllers/group.controller.js";
import { GroupService } from "../../src/services/group.service.js";
import { fakeRequest, fakeResponse } from "../helpers/http.js";

describe("GroupController", () => {
    const getAllGroups = spyOn(GroupService.instance, "getAllGroups");
    const error = spyOn(console, "error");

    beforeEach(() => {
        getAllGroups.mockClear();
        error.mockClear();
        error.mockImplementation(() => {});
    });

    afterAll(() => {
        getAllGroups.mockRestore();
        error.mockRestore();
    });

    describe("getAll", () => {
        it("rend les groupes du service", async () => {
            const groupes = [{ code: "G8a", label: "G8A", year: "A3", mainGroup: 8, subGroup: "a" }];
            getAllGroups.mockResolvedValue(groupes as never);

            const { res, code, body } = fakeResponse();
            await GroupController.instance.getAll(fakeRequest(), res);

            expect(code()).toBe(200);
            expect(body()).toEqual({ success: true, data: groupes });
        });

        it("répond 500 quand le service échoue", async () => {
            getAllGroups.mockRejectedValue(new Error("base injoignable"));

            const { res, code, body } = fakeResponse();
            await GroupController.instance.getAll(fakeRequest(), res);

            expect(code()).toBe(500);
            expect(body()).toMatchObject({ success: false });
            expect(error).toHaveBeenCalled();
        });
    });
});
