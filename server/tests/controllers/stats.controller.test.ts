// ============================================
// 📁 tests/controllers/stats.controller.test.ts
// ============================================
//
// Comme pour l'emploi du temps, le service de statistiques expose des
// fonctions de module : le contrôleur est testé avec son service réel, la
// frontière étant le client Prisma remplacé par `tests/setup.ts`.

import { beforeEach, describe, expect, it, spyOn } from "bun:test";

import { logCommandController } from "../../src/controllers/stats.controller.js";
import { createMockRequest, createMockResponse } from "../helpers/express-mock.js";
import { prismaStatsMock, resetPrismaMocks } from "../helpers/prisma-mock.js";

const BODY = {
    discordUserId: "123456789012345678",
    username: "arthur",
    globalName: "Arthur",
    command: "/salles_maintenant",
};

const KNOWN_USER = { id: 7, name: "arthur", global_name: "Arthur" };

describe("logCommandController", () => {
    beforeEach(() => {
        resetPrismaMocks();
        prismaStatsMock.users.findUnique.mockResolvedValue(KNOWN_USER);
        spyOn(console, "log").mockImplementation(() => {});
        spyOn(console, "error").mockImplementation(() => {});
    });

    it("répond 200 et enregistre la commande", async () => {
        const res = createMockResponse();

        await logCommandController(createMockRequest({ body: BODY }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true });
        const arg: any = prismaStatsMock.requests.create.mock.calls[0]?.[0];
        expect(arg.data.request_text).toBe("/salles_maintenant");
        expect(arg.data.user).toBe(7);
    });

    it("accepte un globalName nul", async () => {
        const res = createMockResponse();

        await logCommandController(
            createMockRequest({ body: { ...BODY, globalName: null } }),
            res,
        );

        expect(res.statusCode).toBe(200);
    });

    it.each([
        ["discordUserId", { ...BODY, discordUserId: undefined }],
        ["username", { ...BODY, username: undefined }],
        ["command", { ...BODY, command: undefined }],
    ])("répond 400 quand %s manque", async (_champ, body) => {
        const res = createMockResponse();

        await logCommandController(createMockRequest({ body }), res);

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(prismaStatsMock.requests.create).not.toHaveBeenCalled();
    });

    it("répond 400 sur un corps vide", async () => {
        const res = createMockResponse();

        await logCommandController(createMockRequest(), res);

        expect(res.statusCode).toBe(400);
        expect(prismaStatsMock.users.findUnique).not.toHaveBeenCalled();
    });

    it("répond 500 quand l'écriture en base échoue", async () => {
        prismaStatsMock.requests.create.mockRejectedValue(new Error("boom"));
        const res = createMockResponse();

        await logCommandController(createMockRequest({ body: BODY }), res);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ success: false, error: "Failed to log command" });
    });

    it("répond 500 quand l'identifiant Discord n'est pas numérique", async () => {
        const res = createMockResponse();

        await logCommandController(
            createMockRequest({ body: { ...BODY, discordUserId: "pas-un-id" } }),
            res,
        );

        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
    });
});
