// ============================================
// 📁 tests/repository/group.repository.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import dataSource from "../../src/utils/dataSource.js";
import { StudentGroup } from "../../src/entities/studentGroup.entity.js";
import groupRepository from "../../src/repository/group.repository.js";

describe("GroupRepository", () => {
    const getRepository = spyOn(dataSource, "getRepository");
    const find = mock();
    const findOneBy = mock();

    beforeEach(() => {
        find.mockClear();
        findOneBy.mockClear();
        find.mockResolvedValue([]);
        findOneBy.mockResolvedValue(null);
        getRepository.mockImplementation((() => ({ find, findOneBy })) as never);
    });

    afterAll(() => {
        getRepository.mockRestore();
    });

    describe("findAll", () => {
        it("ordonne par année, groupe puis sous-groupe", async () => {
            await groupRepository.findAll();

            expect(getRepository).toHaveBeenCalledWith(StudentGroup);
            expect(find).toHaveBeenCalledWith({
                order: { year: "ASC", mainGroup: "ASC", subGroup: "ASC" },
            });
        });

        it("rend ce que la base contient", async () => {
            const groupes = [{ id: 1, code: "G8a" }];
            find.mockResolvedValue(groupes);

            expect(await groupRepository.findAll()).toBe(groupes as never);
        });
    });

    describe("findByCode", () => {
        it("cherche le groupe par son code publié", async () => {
            const groupe = { id: 1, code: "G8a" };
            findOneBy.mockResolvedValue(groupe);

            expect(await groupRepository.findByCode("G8a")).toBe(groupe as never);
            expect(findOneBy).toHaveBeenCalledWith({ code: "G8a" });
        });

        it("rend null pour un code inconnu", async () => {
            expect(await groupRepository.findByCode("G99z")).toBeNull();
        });
    });
});
