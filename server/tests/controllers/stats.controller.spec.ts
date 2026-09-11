// ============================================
// 📁 tests/controllers/stats.controller.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { logCommandController } from "../../src/controllers/stats.controller.js";
import * as statsService from "../../src/services/stats.service.js";
import { fakeRequest, fakeResponse } from "../helpers/http.js";

describe("logCommandController", () => {
    const logCommandService = spyOn(statsService, "logCommandService");
    const error = spyOn(console, "error");

    const corps = { discordUserId: "42", username: "bobbynou", globalName: "Bobby", command: "/salles" };

    beforeEach(() => {
        logCommandService.mockClear();
        error.mockClear();
        error.mockImplementation(() => {});
        logCommandService.mockResolvedValue(undefined);
    });

    afterAll(() => {
        logCommandService.mockRestore();
        error.mockRestore();
    });

    it("consigne la commande et confirme", async () => {
        const { res, code, body } = fakeResponse();
        await logCommandController(fakeRequest({ body: corps }), res);

        expect(code()).toBe(200);
        expect(body()).toEqual({ success: true });
        expect(logCommandService).toHaveBeenCalledWith(corps);
    });

    it("refuse une commande sans identifiant, sans pseudo ou sans texte", async () => {
        for (const manquant of ["discordUserId", "username", "command"]) {
            const partiel = { ...corps, [manquant]: "" };
            const { res, code } = fakeResponse();
            await logCommandController(fakeRequest({ body: partiel }), res);

            expect(code()).toBe(400);
        }
        expect(logCommandService).not.toHaveBeenCalled();
    });

    it("accepte un nom global absent", async () => {
        const { res, code } = fakeResponse();
        await logCommandController(fakeRequest({ body: { ...corps, globalName: null } }), res);

        expect(code()).toBe(200);
    });

    it("répond 500 quand le service échoue", async () => {
        logCommandService.mockRejectedValue(new Error("base injoignable"));

        const { res, code } = fakeResponse();
        await logCommandController(fakeRequest({ body: corps }), res);

        expect(code()).toBe(500);
        expect(error).toHaveBeenCalled();
    });
});
