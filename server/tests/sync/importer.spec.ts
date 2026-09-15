// ============================================
// 📁 tests/sync/importer.spec.ts
// ============================================

import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import dataSource from "../../src/utils/dataSource.js";
import { EdtSource } from "../../src/entities/edtSource.entity.js";
import { Lesson } from "../../src/entities/lesson.entity.js";
import { LessonGroup } from "../../src/entities/lessonGroup.entity.js";
import { Room } from "../../src/entities/room.entity.js";
import { StudentGroup } from "../../src/entities/studentGroup.entity.js";
import { Subject } from "../../src/entities/subject.entity.js";
import { Teacher } from "../../src/entities/teacher.entity.js";
import { ImportCaches, Importer, computeDedupKey } from "../../src/sync/importer.js";
import type { ParsedLesson, SourceFile } from "../../src/sync/types.js";

/** Un cours tel que le parseur le rend. */
function parsed(options: Partial<ParsedLesson> = {}): ParsedLesson {
    return {
        start: new Date("2026-09-10T06:00:00.000Z"),
        end: new Date("2026-09-10T08:00:00.000Z"),
        type: "TP",
        subjectCode: "R5A.14",
        subjectLabel: "Anglais",
        teacherName: "JP",
        roomNames: ["R52"],
        unknownRooms: [],
        groupCodes: ["G8a"],
        rawContent: "R5A.14 - JP - R52",
        degraded: false,
        ...options,
    } as ParsedLesson;
}

describe("computeDedupKey", () => {
    it("rend la même empreinte pour deux lectures identiques", () => {
        expect(computeDedupKey(parsed())).toBe(computeDedupKey(parsed()));
    });

    it("ignore l'ordre des salles", () => {
        // Un même cours peut être lu `108-9` ou `109-8` selon le document.
        expect(computeDedupKey(parsed({ roomNames: ["108", "109"] }))).toBe(
            computeDedupKey(parsed({ roomNames: ["109", "108"] })),
        );
    });

    it("distingue deux cours sur chacun des critères", () => {
        const référence = computeDedupKey(parsed());

        expect(computeDedupKey(parsed({ start: new Date("2026-09-10T07:00:00.000Z") }))).not.toBe(référence);
        expect(computeDedupKey(parsed({ end: new Date("2026-09-10T09:00:00.000Z") }))).not.toBe(référence);
        expect(computeDedupKey(parsed({ type: "TD" }))).not.toBe(référence);
        expect(computeDedupKey(parsed({ subjectCode: "R5A.06" }))).not.toBe(référence);
        expect(computeDedupKey(parsed({ teacherName: "SM" }))).not.toBe(référence);
        expect(computeDedupKey(parsed({ roomNames: ["R46"] }))).not.toBe(référence);
    });

    it("ne dépend ni du groupe ni du contenu brut", () => {
        // Un cours de promotion apparaît dans chaque emploi du temps de groupe :
        // il ne doit être stocké qu'une fois.
        const référence = computeDedupKey(parsed());
        expect(computeDedupKey(parsed({ groupCodes: ["G7b"] }))).toBe(référence);
        expect(computeDedupKey(parsed({ rawContent: "autre chose" }))).toBe(référence);
    });

    it("traite un cours sans enseignant", () => {
        expect(computeDedupKey(parsed({ teacherName: null }))).toBeString();
    });
});

// Un seul espion pour tout le fichier : deux `spyOn` sur la même méthode se
// restaurent l'un l'autre dès la fin du premier `describe`.
const getRepository = spyOn(dataSource, "getRepository");
afterAll(() => getRepository.mockRestore());

describe("ImportCaches", () => {
    const find = mock(async () => [] as unknown[]);

    beforeEach(() => {
        find.mockClear();
        getRepository.mockImplementation((() => ({ find })) as never);
    });

    it("charge le référentiel de salles par leur nom", async () => {
        find.mockResolvedValue([{ id: 1, name: "R52" }]);

        const caches = new ImportCaches();
        await caches.loadRooms();

        expect(getRepository).toHaveBeenCalledWith(Room);
        expect(caches.rooms.get("R52")).toEqual({ id: 1, name: "R52" } as never);
    });
});

describe("Importer", () => {
    /** Un dépôt TypeORM réduit aux méthodes que l'importer appelle. */
    const dépôts = new Map<unknown, Record<string, ReturnType<typeof mock>>>();

    function dépôt(entité: unknown) {
        const existant = dépôts.get(entité);
        if (existant) return existant;

        const insérer = {
            insert: mock(() => insérer),
            values: mock(() => insérer),
            orIgnore: mock(() => insérer),
            delete: mock(() => insérer),
            where: mock(() => insérer),
            execute: mock(async () => ({ affected: 0 })),
        };

        const créé = {
            findOne: mock(async () => null),
            findOneBy: mock(async () => null),
            find: mock(async () => []),
            save: mock(async (valeur: unknown) => ({ id: 1, ...(valeur as object) })),
            create: mock((valeur: unknown) => valeur),
            update: mock(async () => undefined),
            createQueryBuilder: mock(() => insérer),
            // Étalé en dernier : `insérer` porte lui aussi `delete`, celui du
            // constructeur de requête, et c'est celui-là qui doit primer.
            ...insérer,
        } as unknown as Record<string, ReturnType<typeof mock>>;

        dépôts.set(entité, créé);
        return créé;
    }

    const caches = new ImportCaches();
    const source = { id: 3 } as EdtSource;

    beforeEach(() => {
        dépôts.clear();
        caches.subjects.clear();
        caches.teachers.clear();
        caches.groups.clear();
        caches.rooms.clear();
        getRepository.mockImplementation(((entité: unknown) => dépôt(entité)) as never);
    });

    describe("getOrCreateSource", () => {
        const fichier = {
            year: "A3",
            scope: "A3",
            weekNumber: 1,
            format: "pdf",
            fileName: "A3_S1.pdf",
            url: "https://edt.test/A3_S1.pdf",
        } as SourceFile;

        it("réutilise la ligne de suivi existante", async () => {
            dépôt(EdtSource).findOneBy.mockResolvedValue({ id: 9 });

            expect(await Importer.instance.getOrCreateSource(fichier)).toEqual({ id: 9 } as never);
            expect(dépôt(EdtSource).save).not.toHaveBeenCalled();
        });

        it("crée la ligne de suivi au premier passage", async () => {
            await Importer.instance.getOrCreateSource(fichier);

            expect(dépôt(EdtSource).save).toHaveBeenCalled();
            expect(dépôt(EdtSource).findOneBy).toHaveBeenCalledWith({
                scope: "A3",
                weekNumber: 1,
                format: "pdf",
            });
        });
    });

    describe("importLessons", () => {
        it("repart des seuls rattachements du fichier", async () => {
            // Un fichier republié peut avoir perdu des cours : ses liens sont
            // effacés, ceux des autres fichiers ne bougent pas.
            await Importer.instance.importLessons(caches, source, [], "A3");

            expect(dépôt(LessonGroup).delete).toHaveBeenCalledWith({ sourceId: 3 });
        });

        it("compte les cours créés et les rattachements posés", async () => {
            const bilan = await Importer.instance.importLessons(
                caches,
                source,
                [parsed({ groupCodes: ["G8a", "G8b"] })],
                "A3",
            );

            expect(bilan).toEqual({ lessonsCreated: 1, lessonsLinked: 2 });
        });

        it("ne recrée pas un cours déjà enregistré sous la même empreinte", async () => {
            dépôt(Lesson).findOne.mockResolvedValue({ id: 5, rooms: [] });

            const bilan = await Importer.instance.importLessons(caches, source, [parsed()], "A3");

            expect(bilan.lessonsCreated).toBe(0);
            expect(bilan.lessonsLinked).toBe(1);
        });

        it("date le fichier importé", async () => {
            await Importer.instance.importLessons(caches, source, [], "A3");

            expect(dépôt(EdtSource).update).toHaveBeenCalled();
        });

        it("refuse un code de groupe illisible", async () => {
            expect(
                Importer.instance.importLessons(caches, source, [parsed({ groupCodes: ["???"] })], "A3"),
            ).rejects.toThrow("Code de groupe illisible");
        });
    });

    describe("rattachement des salles", () => {
        it("complète un cours enregistré sans ses salles", async () => {
            // Cas d'un import fait alors que le référentiel était vide :
            // l'empreinte ne change pas, seules les salles manquent.
            caches.rooms.set("R52", { id: 2, name: "R52" } as Room);
            dépôt(Lesson).findOne.mockResolvedValue({ id: 5, rooms: [] });

            await Importer.instance.importLessons(caches, source, [parsed()], "A3");

            const enregistré = dépôt(Lesson).save.mock.calls[0]![0] as { rooms: Room[] };
            expect(enregistré.rooms.map((r) => r.id)).toEqual([2]);
        });

        it("n'écrit rien quand le cours a déjà ses salles", async () => {
            caches.rooms.set("R52", { id: 2, name: "R52" } as Room);
            dépôt(Lesson).findOne.mockResolvedValue({ id: 5, rooms: [{ id: 2, name: "R52" }] });

            await Importer.instance.importLessons(caches, source, [parsed()], "A3");

            expect(dépôt(Lesson).save).not.toHaveBeenCalled();
        });

        it("accepte un cours existant dont les salles ne sont pas chargées", async () => {
            dépôt(Lesson).findOne.mockResolvedValue({ id: 5 });

            await Importer.instance.importLessons(caches, source, [parsed({ roomNames: [] })], "A3");

            expect(dépôt(Lesson).save).not.toHaveBeenCalled();
        });

        it("écarte une salle absente du référentiel", async () => {
            await Importer.instance.importLessons(caches, source, [parsed({ roomNames: ["Z99"] })], "A3");

            const créé = dépôt(Lesson).save.mock.calls[0]![0] as { rooms: Room[] };
            expect(créé.rooms).toEqual([]);
        });
    });

    describe("caches d'un passage", () => {
        it("n'interroge la base qu'une fois par matière", async () => {
            await Importer.instance.importLessons(caches, source, [parsed(), parsed({ start: new Date("2026-09-11T06:00:00.000Z") })], "A3");

            expect(dépôt(Subject).findOneBy).toHaveBeenCalledTimes(1);
        });

        it("n'interroge la base qu'une fois par enseignant", async () => {
            await Importer.instance.importLessons(caches, source, [parsed(), parsed({ start: new Date("2026-09-11T06:00:00.000Z") })], "A3");

            expect(dépôt(Teacher).findOneBy).toHaveBeenCalledTimes(1);
        });

        it("n'interroge la base qu'une fois par groupe", async () => {
            await Importer.instance.importLessons(caches, source, [parsed(), parsed({ start: new Date("2026-09-11T06:00:00.000Z") })], "A3");

            expect(dépôt(StudentGroup).findOneBy).toHaveBeenCalledTimes(1);
        });

        it("réutilise un enseignant déjà en base sans le réécrire", async () => {
            dépôt(Teacher).findOneBy.mockResolvedValue({ id: 4, name: "JP" });

            await Importer.instance.importLessons(caches, source, [parsed()], "A3");

            expect(dépôt(Teacher).save).not.toHaveBeenCalled();
        });

        it("n'appelle pas l'enseignant pour un cours qui n'en a pas", async () => {
            await Importer.instance.importLessons(caches, source, [parsed({ teacherName: null })], "A3");

            expect(dépôt(Teacher).findOneBy).not.toHaveBeenCalled();
        });
    });

    describe("intitulé des matières", () => {
        // `S5A.02` n'existe pas dans le programme national : son intitulé vient
        // des cases, et c'est là que l'ordre de lecture pouvait tout défaire.
        const locale = { subjectCode: "S5A.02", subjectLabel: "Projet tutoré" };

        it("préfère l'intitulé du programme national au texte de la case", async () => {
            await Importer.instance.importLessons(
                caches,
                source,
                [parsed({ subjectCode: "R5A.10", subjectLabel: "NoSQL" })],
                "A3",
            );

            expect(dépôt(Subject).save).toHaveBeenCalledWith({
                code: "R5A.10",
                label: "Nouveaux paradigmes de base de données",
            });
        });

        it("garde l'intitulé en base face à une case qui ne donne que le code", async () => {
            dépôt(Subject).findOneBy.mockResolvedValue({ id: 7, code: "S5A.02", label: "Projet tutoré" });

            await Importer.instance.importLessons(caches, source, [parsed({ subjectCode: "S5A.02", subjectLabel: "S5A.02" })], "A3");

            expect(dépôt(Subject).save).not.toHaveBeenCalled();
        });

        it("remplace un intitulé qui n'était que le code", async () => {
            dépôt(Subject).findOneBy.mockResolvedValue({ id: 7, code: "S5A.02", label: "S5A.02" });

            await Importer.instance.importLessons(caches, source, [parsed(locale)], "A3");

            expect(dépôt(Subject).save).toHaveBeenCalledWith({ id: 7, code: "S5A.02", label: "Projet tutoré" });
        });

        it("retient l'intitulé lu après une case compacte dans le même passage", async () => {
            await Importer.instance.importLessons(
                caches,
                source,
                [
                    parsed({ subjectCode: "S5A.02", subjectLabel: "S5A.02" }),
                    parsed({ ...locale, start: new Date("2026-09-11T06:00:00.000Z") }),
                ],
                "A3",
            );

            const dernier = dépôt(Subject).save.mock.calls.at(-1)![0] as { label: string };
            expect(dernier.label).toBe("Projet tutoré");
            expect(dépôt(Subject).findOneBy).toHaveBeenCalledTimes(1);
        });

        it("répare l'intitulé même quand le cours est déjà enregistré", async () => {
            dépôt(Lesson).findOne.mockResolvedValue({ id: 5, rooms: [] });
            dépôt(Subject).findOneBy.mockResolvedValue({ id: 7, code: "R5A.14", label: "R5A.14" });

            await Importer.instance.importLessons(caches, source, [parsed({ roomNames: [] })], "A3");

            expect(dépôt(Subject).save).toHaveBeenCalledWith({ id: 7, code: "R5A.14", label: "Anglais" });
        });
    });

    describe("deleteOrphanLessons", () => {
        it("rend le nombre de cours supprimés", async () => {
            dépôt(Lesson).execute.mockResolvedValue({ affected: 4 });
            expect(await Importer.instance.deleteOrphanLessons()).toBe(4);
        });

        it("rend zéro quand la base ne le dit pas", async () => {
            dépôt(Lesson).execute.mockResolvedValue({});
            expect(await Importer.instance.deleteOrphanLessons()).toBe(0);
        });
    });

    describe("suivi des fichiers", () => {
        it("enregistre les en-têtes de cache après téléchargement", async () => {
            await Importer.instance.updateSourceHeaders(3, {
                url: "https://edt.test/A3_S1.pdf",
                etag: "e2",
                lastModified: "lm2",
                contentHash: "h2",
                backupPath: "/tmp/x.pdf",
            });

            const [id, valeurs] = dépôt(EdtSource).update.mock.calls[0] as [number, { etag: string }];
            expect(id).toBe(3);
            expect(valeurs.etag).toBe("e2");
        });

        it("date un fichier inchangé sans toucher au reste", async () => {
            await Importer.instance.touchSource(3);

            const [, valeurs] = dépôt(EdtSource).update.mock.calls[0] as [number, Record<string, unknown>];
            expect(Object.keys(valeurs)).toEqual(["fetchedAt"]);
        });
    });
});
