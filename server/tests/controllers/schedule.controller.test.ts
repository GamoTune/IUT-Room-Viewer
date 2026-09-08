// ============================================
// 📁 tests/controllers/schedule.controller.test.ts
// ============================================
//
// Contrôleur et service sont ici exercés ensemble : le service expose des
// fonctions de module, non des méthodes espionnables. La frontière de test
// reste le client Prisma, remplacé par `tests/setup.ts`.

import { beforeEach, describe, expect, it, spyOn } from "bun:test";

import { getSchedule } from "../../src/controllers/schedule.controller.js";
import { createMockRequest, createMockResponse } from "../helpers/express-mock.js";
import { prismaEdtMock, resetPrismaMocks } from "../helpers/prisma-mock.js";
import { lessonFull } from "../helpers/fixtures.js";

describe("getSchedule (contrôleur)", () => {
    beforeEach(() => {
        resetPrismaMocks();
        spyOn(console, "error").mockImplementation(() => {});
    });

    it("répond 200 avec l'emploi du temps du groupe", async () => {
        prismaEdtMock.lesson.findMany.mockResolvedValue([lessonFull()]);
        const res = createMockResponse();

        await getSchedule(createMockRequest({ query: { group: "G1" } }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.group).toBe("G1");
        expect(res.body.data.year).toBe("BUT1");
        expect(res.body.data.courses).toHaveLength(1);
    });

    it("reprend le TP et la date demandés", async () => {
        const res = createMockResponse();

        await getSchedule(
            createMockRequest({ query: { group: "G4", tp: "B", date: "2026-09-07" } }),
            res,
        );

        expect(res.body.data).toMatchObject({
            group: "G4",
            tp: "B",
            date: "2026-09-07",
            year: "BUT2",
        });
    });

    it("ignore un paramètre répété (tableau) plutôt que de le transmettre", async () => {
        const res = createMockResponse();

        await getSchedule(createMockRequest({ query: { group: "G1", tp: ["A", "B"] } }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.tp).toBeUndefined();
    });

    it("répond 400 quand le groupe est absent", async () => {
        const res = createMockResponse();

        await getSchedule(createMockRequest({ query: {} }), res);

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(prismaEdtMock.lesson.findMany).not.toHaveBeenCalled();
    });

    it("répond 400 quand le groupe n'est pas une chaîne", async () => {
        const res = createMockResponse();

        await getSchedule(createMockRequest({ query: { group: ["G1", "G2"] } }), res);

        expect(res.statusCode).toBe(400);
        expect(prismaEdtMock.lesson.findMany).not.toHaveBeenCalled();
    });

    it("répond 500 quand la base est indisponible", async () => {
        prismaEdtMock.lesson.findMany.mockRejectedValue(new Error("BDD indisponible"));
        const res = createMockResponse();

        await getSchedule(createMockRequest({ query: { group: "G1" } }), res);

        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
        // Le message d'erreur interne ne doit pas fuiter vers le client.
        expect(res.body.error).not.toContain("BDD indisponible");
    });
});
