// ============================================
// 📁 tests/repository/source.repository.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { In } from "typeorm";
import dataSource from "../../src/utils/dataSource.js";
import { EdtSource } from "../../src/entities/edtSource.entity.js";
import sourceRepository from "../../src/repository/source.repository.js";

describe("SourceRepository", () => {
    const createQueryBuilder = spyOn(dataSource, "createQueryBuilder");
    const getRepository = spyOn(dataSource, "getRepository");

    const find = mock();
    const getRawOne = mock();
    let conditions: { sql: string; params: Record<string, unknown> }[] = [];

    /** Constructeur de requête chaînable, qui retient les conditions posées. */
    function fauxBuilder() {
        const builder = {
            innerJoin: () => builder,
            select: () => builder,
            orderBy: () => builder,
            where: (sql: string, params: Record<string, unknown>) => {
                conditions.push({ sql, params });
                return builder;
            },
            andWhere: (sql: string, params: Record<string, unknown>) => {
                conditions.push({ sql, params });
                return builder;
            },
            getRawOne,
        };
        return builder;
    }

    const lundi = new Date("2026-09-06T22:00:00.000Z");
    const lundiSuivant = new Date("2026-09-13T22:00:00.000Z");

    beforeEach(() => {
        conditions = [];
        find.mockClear();
        getRawOne.mockClear();
        find.mockResolvedValue([]);
        getRawOne.mockResolvedValue(undefined);
        createQueryBuilder.mockImplementation(fauxBuilder as never);
        getRepository.mockImplementation((() => ({ find })) as never);
    });

    afterAll(() => {
        createQueryBuilder.mockRestore();
        getRepository.mockRestore();
    });

    describe("findWeekNumber", () => {
        it("rend la semaine du document d'année dont des cours tombent dans la période", async () => {
            getRawOne.mockResolvedValue({ weekNumber: 2 });

            expect(await sourceRepository.findWeekNumber("A3", lundi, lundiSuivant)).toBe(2);
        });

        it("convertit la semaine quand le pilote la rend en texte", async () => {
            // `smallint` peut remonter en chaîne selon le pilote et la requête brute.
            getRawOne.mockResolvedValue({ weekNumber: "4" });

            expect(await sourceRepository.findWeekNumber("A3", lundi, lundiSuivant)).toBe(4);
        });

        it("rend null quand aucun cours ne couvre la période", async () => {
            expect(await sourceRepository.findWeekNumber("A3", lundi, lundiSuivant)).toBeNull();
        });

        it("ne consulte que le PDF de la promotion", async () => {
            await sourceRepository.findWeekNumber("A3", lundi, lundiSuivant);

            const [promotion] = conditions;
            expect(promotion!.sql).toContain("source.scope = :scope");
            expect(promotion!.sql).toContain("source.format = 'pdf'");
            // Deux paramètres distincts : `year` est un enum, `scope` du texte.
            expect(promotion!.params).toEqual({ year: "A3", scope: "A3" });
        });

        it("borne la période sur le début des cours", async () => {
            await sourceRepository.findWeekNumber("A3", lundi, lundiSuivant);

            expect(conditions[1]!.params).toEqual({ from: lundi, to: lundiSuivant });
        });
    });

    describe("findFiles", () => {
        it("cherche les documents de la semaine pour les périmètres demandés", async () => {
            const fichiers = [{ id: 1, scope: "G8a", format: "pdf" }];
            find.mockResolvedValue(fichiers);

            expect(await sourceRepository.findFiles(2, ["G8a", "G8", "A3"])).toBe(fichiers as never);
            expect(getRepository).toHaveBeenCalledWith(EdtSource);
            expect(find).toHaveBeenCalledWith({ where: { weekNumber: 2, scope: In(["G8a", "G8", "A3"]) } });
        });

        it("n'interroge pas la base sans périmètre", async () => {
            expect(await sourceRepository.findFiles(2, [])).toEqual([]);
            expect(find).not.toHaveBeenCalled();
        });
    });
});
