// ============================================
// 📁 tests/services/stats.service.test.ts
// ============================================

import { beforeEach, describe, expect, it, spyOn } from "bun:test";

import { logCommandService } from "../../src/services/stats.service.js";
import { prismaStatsMock, resetPrismaMocks } from "../helpers/prisma-mock.js";

const COMMAND = {
    discordUserId: "123456789012345678",
    username: "arthur",
    globalName: "Arthur",
    command: "/salles_maintenant",
};

describe("logCommandService", () => {
    beforeEach(() => {
        resetPrismaMocks();
        // Le service journalise sur la sortie standard : on la neutralise.
        spyOn(console, "log").mockImplementation(() => {});
    });

    it("recherche l'utilisateur par son identifiant Discord converti en BigInt", async () => {
        prismaStatsMock.users.findUnique.mockResolvedValue({
            id: 7,
            name: "arthur",
            global_name: "Arthur",
        });

        await logCommandService(COMMAND);

        expect(prismaStatsMock.users.findUnique).toHaveBeenCalledWith({
            where: { user_id: BigInt(COMMAND.discordUserId) },
        });
    });

    it("crée l'utilisateur lorsqu'il est inconnu", async () => {
        prismaStatsMock.users.findUnique.mockResolvedValue(null);
        prismaStatsMock.users.create.mockResolvedValue({ id: 7 });

        await logCommandService(COMMAND);

        expect(prismaStatsMock.users.create).toHaveBeenCalledWith({
            data: {
                user_id: BigInt(COMMAND.discordUserId),
                name: "arthur",
                global_name: "Arthur",
            },
        });
        expect(prismaStatsMock.users.update).not.toHaveBeenCalled();
    });

    it("met à jour le profil quand le pseudo a changé", async () => {
        prismaStatsMock.users.findUnique.mockResolvedValue({
            id: 7,
            name: "ancien_pseudo",
            global_name: "Arthur",
        });
        prismaStatsMock.users.update.mockResolvedValue({ id: 7 });

        await logCommandService(COMMAND);

        expect(prismaStatsMock.users.update).toHaveBeenCalledWith({
            where: { id: 7 },
            data: { name: "arthur", global_name: "Arthur" },
        });
        expect(prismaStatsMock.users.create).not.toHaveBeenCalled();
    });

    it("n'écrit rien quand le profil est déjà à jour", async () => {
        prismaStatsMock.users.findUnique.mockResolvedValue({
            id: 7,
            name: "arthur",
            global_name: "Arthur",
        });

        await logCommandService(COMMAND);

        expect(prismaStatsMock.users.update).not.toHaveBeenCalled();
        expect(prismaStatsMock.users.create).not.toHaveBeenCalled();
    });

    it("enregistre la commande en la rattachant à l'utilisateur", async () => {
        prismaStatsMock.users.findUnique.mockResolvedValue({
            id: 7,
            name: "arthur",
            global_name: "Arthur",
        });

        await logCommandService(COMMAND);

        expect(prismaStatsMock.requests.create).toHaveBeenCalledTimes(1);
        const arg: any = prismaStatsMock.requests.create.mock.calls[0]?.[0];
        expect(arg.data.request_text).toBe("/salles_maintenant");
        expect(arg.data.user).toBe(7);
        expect(arg.data.request_date).toBeInstanceOf(Date);
    });

    it("rattache la commande à l'utilisateur fraîchement créé", async () => {
        prismaStatsMock.users.findUnique.mockResolvedValue(null);
        prismaStatsMock.users.create.mockResolvedValue({ id: 42 });

        await logCommandService(COMMAND);

        const arg: any = prismaStatsMock.requests.create.mock.calls[0]?.[0];
        expect(arg.data.user).toBe(42);
    });

    it("propage l'erreur d'un identifiant Discord non numérique", async () => {
        await expect(
            logCommandService({ ...COMMAND, discordUserId: "pas-un-id" }),
        ).rejects.toThrow();

        expect(prismaStatsMock.requests.create).not.toHaveBeenCalled();
    });
});
