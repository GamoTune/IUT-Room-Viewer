// ============================================
// 📁 tests/services/stats.service.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import dataSource from "../../src/utils/dataSource.js";
import { Request } from "../../src/entities/request.entity.js";
import { User } from "../../src/entities/user.entity.js";
import { logCommandService } from "../../src/services/stats.service.js";

describe("logCommandService", () => {
    const getRepository = spyOn(dataSource, "getRepository");
    const log = spyOn(console, "log");

    const findOneBy = mock();
    const saveUser = mock();
    const saveRequest = mock();

    const commande = {
        discordUserId: "42",
        username: "bobbynou",
        globalName: "Bobby",
        command: "/salles",
    };

    beforeEach(() => {
        findOneBy.mockClear();
        saveUser.mockClear();
        saveRequest.mockClear();
        log.mockClear();
        log.mockImplementation(() => {});

        findOneBy.mockResolvedValue(null);
        saveUser.mockResolvedValue({ id: 7 });
        saveRequest.mockResolvedValue({ id: 1 });

        getRepository.mockImplementation(((entity: unknown) =>
            entity === User ? { findOneBy, save: saveUser } : { save: saveRequest }) as never);
    });

    afterAll(() => {
        getRepository.mockRestore();
        log.mockRestore();
    });

    it("crée l'utilisateur à sa première commande", async () => {
        await logCommandService(commande);

        expect(saveUser).toHaveBeenCalledWith({
            discordId: "42",
            name: "bobbynou",
            globalName: "Bobby",
        });
    });

    it("rafraîchit les pseudos d'un utilisateur déjà connu", async () => {
        // Les pseudos Discord changent : l'enregistrement existant est complété.
        findOneBy.mockResolvedValue({ id: 7, discordId: "42", name: "ancien", globalName: "Ancien" });

        await logCommandService(commande);

        expect(saveUser).toHaveBeenCalledWith({
            id: 7,
            discordId: "42",
            name: "bobbynou",
            globalName: "Bobby",
        });
    });

    it("rattache la requête à l'utilisateur enregistré", async () => {
        await logCommandService(commande);

        expect(saveRequest).toHaveBeenCalledWith({ requestText: "/salles", user: { id: 7 } });
    });

    it("accepte un nom global absent", async () => {
        await logCommandService({ ...commande, globalName: null });

        expect(saveUser.mock.calls[0]![0]).toMatchObject({ globalName: null });
    });

    it("consigne la commande dans le journal", async () => {
        await logCommandService(commande);
        expect(log).toHaveBeenCalled();
    });

    it("interroge bien les deux entités", async () => {
        await logCommandService(commande);
        expect(getRepository).toHaveBeenCalledWith(User);
        expect(getRepository).toHaveBeenCalledWith(Request);
    });
});
