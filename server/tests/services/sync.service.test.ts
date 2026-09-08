// ============================================
// 📁 tests/services/sync.service.test.ts
// ============================================

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

import { SyncService } from "../../src/services/sync.service.js";
import { SyncRepository } from "../../src/repository/sync.repository.js";

/** Résultat d'une semaine synchronisée. */
function syncResult(overrides: Partial<any> = {}) {
    return {
        success: true,
        year: "A1",
        weekNumber: 37,
        lessonsAdded: 10,
        lessonsUpdated: 0,
        skipped: false,
        message: "10 cours synchronisés",
        ...overrides,
    };
}

let syncYear: ReturnType<typeof spyOn>;
let deleteAllEdts: ReturnType<typeof spyOn>;

describe("SyncService", () => {
    beforeEach(() => {
        // `syncYear` parle au site de l'IUT : on le remplace pour ne tester
        // que l'orchestration et le bilan produit par `syncAll`.
        syncYear = spyOn(SyncService.instance, "syncYear").mockResolvedValue([]);
        deleteAllEdts = spyOn(SyncRepository.instance, "deleteAllEdts").mockResolvedValue(12);
        spyOn(console, "log").mockImplementation(() => {});
        spyOn(console, "error").mockImplementation(() => {});

        // Le service est un singleton porteur d'état : on repart du repos.
        (SyncService.instance as any).status = { isRunning: false, lastSync: null };
    });

    afterEach(() => {
        mock.restore();
    });

    describe("getStatus", () => {
        it("indique qu'aucune synchronisation ne tourne au repos", () => {
            expect(SyncService.instance.getStatus().isRunning).toBe(false);
        });
    });

    describe("reset", () => {
        it("supprime les EDT et remet le statut à zéro", async () => {
            const deleted = await SyncService.instance.reset();

            expect(deleted).toBe(12);
            expect(deleteAllEdts).toHaveBeenCalledTimes(1);
            expect(SyncService.instance.getStatus()).toEqual({
                isRunning: false,
                lastSync: null,
            });
        });
    });

    describe("syncAll", () => {
        it("synchronise les trois années", async () => {
            await SyncService.instance.syncAll();

            expect(syncYear).toHaveBeenCalledTimes(3);
            expect(syncYear.mock.calls.map((call) => call[0])).toEqual(["A1", "A2", "A3"]);
        });

        it("agrège les compteurs des semaines traitées et ignorées", async () => {
            syncYear.mockResolvedValue([
                syncResult({ lessonsAdded: 10 }),
                syncResult({ skipped: true, lessonsAdded: 0 }),
            ]);

            const summary = await SyncService.instance.syncAll();

            // Trois années × (1 semaine traitée + 1 ignorée)
            expect(summary.totalEdtProcessed).toBe(3);
            expect(summary.totalEdtSkipped).toBe(3);
            expect(summary.totalLessonsProcessed).toBe(30);
            expect(summary.success).toBe(true);
            expect(summary.errors).toEqual([]);
        });

        it("poursuit les autres années quand l'une échoue", async () => {
            syncYear.mockImplementation(async (year: any) => {
                if (year === "A2") throw new Error("Fichier indisponible");
                return [syncResult()];
            });

            const summary = await SyncService.instance.syncAll();

            expect(summary.success).toBe(false);
            expect(summary.errors).toHaveLength(1);
            expect(summary.errors[0]).toContain("A2");
            expect(summary.totalEdtProcessed).toBe(2);
        });

        it("date le début et la fin de la synchronisation", async () => {
            const summary = await SyncService.instance.syncAll();

            expect(summary.startedAt).toBeInstanceOf(Date);
            expect(summary.completedAt).toBeInstanceOf(Date);
            expect(summary.completedAt.getTime()).toBeGreaterThanOrEqual(
                summary.startedAt.getTime(),
            );
        });

        it("conserve le bilan comme dernière synchronisation et libère le verrou", async () => {
            const summary = await SyncService.instance.syncAll();

            const status = SyncService.instance.getStatus();
            expect(status.isRunning).toBe(false);
            expect(status.lastSync).toBe(summary);
        });

        it("refuse une seconde synchronisation tant que la première tourne", async () => {
            // Barrière partagée par les trois années : la première synchronisation
            // reste en cours tant qu'on ne l'ouvre pas.
            let open: () => void = () => {};
            const gate = new Promise<void>((resolve) => {
                open = resolve;
            });
            syncYear.mockImplementation(async () => {
                await gate;
                return [];
            });

            const first = SyncService.instance.syncAll();
            await Promise.resolve(); // laisse `syncAll` poser le verrou

            expect(SyncService.instance.getStatus().isRunning).toBe(true);
            await expect(SyncService.instance.syncAll()).rejects.toThrow(
                "Une synchronisation est déjà en cours",
            );

            open();
            await first;
            expect(SyncService.instance.getStatus().isRunning).toBe(false);
        });

        it("libère le verrou même si tout échoue", async () => {
            syncYear.mockRejectedValue(new Error("réseau"));

            await SyncService.instance.syncAll();

            expect(SyncService.instance.getStatus().isRunning).toBe(false);
        });
    });
});

// ============================================
// Traitement d'une semaine et formatage des cours
// ============================================
//
// `processEntry` reçoit une entrée telle que la produit la librairie Unilim
// (stubée dans `tests/setup.ts`) : on en fabrique une, sans réseau.

/** Une entrée d'emploi du temps publiée par l'IUT. */
function timetableEntry(overrides: Partial<any> = {}) {
    return {
        weekNumber: 37,
        fromYear: "A1",
        lastUpdated: { toJSDate: () => new Date("2026-09-01T12:00:00.000Z") },
        url: new URL("https://example.test/edt-37.ics"),
        getTimetable: async () => ({ lessons: [] }),
        ...overrides,
    };
}

/** Un cours brut Unilim. */
function timetableLesson(overrides: Partial<any> = {}) {
    return {
        start_date: { toJSDate: () => new Date("2026-09-07T08:00:00.000Z") },
        end_date: { toJSDate: () => new Date("2026-09-07T10:00:00.000Z") },
        type: "TP",
        content: {
            type: "R3.01",
            description: "Développement web",
            teacher: "Hugel T.",
            room: "S101",
        },
        ...overrides,
    };
}

describe("SyncService.processEntry", () => {
    let findEdt: ReturnType<typeof spyOn>;
    let upsertEdt: ReturnType<typeof spyOn>;
    let deleteLessons: ReturnType<typeof spyOn>;
    let upsertLesson: ReturnType<typeof spyOn>;
    let linkLessonToRoom: ReturnType<typeof spyOn>;
    let linkLessonToGroup: ReturnType<typeof spyOn>;

    beforeEach(() => {
        spyOn(console, "log").mockImplementation(() => {});
        findEdt = spyOn(SyncRepository.instance, "findEdtByWeekAndYear").mockResolvedValue(null);
        upsertEdt = spyOn(SyncRepository.instance, "upsertEdt").mockResolvedValue({ id: 30 } as any);
        deleteLessons = spyOn(SyncRepository.instance, "deleteLessonsByEdtId").mockResolvedValue(5);
        upsertLesson = spyOn(SyncRepository.instance, "upsertLesson").mockResolvedValue({ id: 1 } as any);
        linkLessonToRoom = spyOn(SyncRepository.instance, "linkLessonToRoom").mockResolvedValue({} as any);
        linkLessonToGroup = spyOn(SyncRepository.instance, "linkLessonToGroup").mockResolvedValue({} as any);
        spyOn(SyncRepository.instance, "upsertContent").mockResolvedValue({ id: 10 } as any);
        spyOn(SyncRepository.instance, "upsertTeacher").mockResolvedValue({ id: 20 } as any);
        spyOn(SyncRepository.instance, "upsertRoom").mockResolvedValue({ id: 40 } as any);
        spyOn(SyncRepository.instance, "upsertStudentGroup").mockResolvedValue({ id: 50 } as any);
    });

    afterEach(() => {
        mock.restore();
    });

    it("ignore une semaine dont la version en base est à jour", async () => {
        findEdt.mockResolvedValue({
            id: 30,
            last_updated: new Date("2026-09-02T12:00:00.000Z"),
        });

        const result = await SyncService.instance.processEntry(timetableEntry() as any);

        expect(result.skipped).toBe(true);
        expect(result.lessonsAdded).toBe(0);
        expect(upsertEdt).not.toHaveBeenCalled();
    });

    it("retélécharge une semaine dont la publication est plus récente", async () => {
        findEdt.mockResolvedValue({
            id: 30,
            last_updated: new Date("2026-08-20T12:00:00.000Z"),
        });

        const result = await SyncService.instance.processEntry(
            timetableEntry({
                getTimetable: async () => ({ lessons: [timetableLesson()] }),
            }) as any,
        );

        expect(result.skipped).toBe(false);
        expect(result.lessonsAdded).toBe(1);
        // Les anciens cours de la semaine sont purgés avant réinsertion.
        expect(deleteLessons).toHaveBeenCalledWith(30);
    });

    it("n'essaie pas de purger une semaine encore inconnue", async () => {
        await SyncService.instance.processEntry(timetableEntry() as any);

        expect(deleteLessons).not.toHaveBeenCalled();
        expect(upsertEdt).toHaveBeenCalledWith({
            weekNumber: 37,
            fromYear: "A1",
            link: "https://example.test/edt-37.ics",
            lastUpdated: new Date("2026-09-01T12:00:00.000Z"),
        });
    });

    it("rattache chaque cours à son EDT, ses salles et son groupe", async () => {
        await SyncService.instance.processEntry(
            timetableEntry({
                getTimetable: async () => ({ lessons: [timetableLesson()] }),
            }) as any,
        );

        expect(upsertLesson).toHaveBeenCalledWith({
            type: "TP",
            startDatetime: new Date("2026-09-07T08:00:00.000Z"),
            endDatetime: new Date("2026-09-07T10:00:00.000Z"),
            contentId: 10,
            teacherId: 20,
            edtId: 30,
        });
        expect(linkLessonToRoom).toHaveBeenCalledWith(1, 40);
        expect(linkLessonToGroup).toHaveBeenCalledWith(1, 50);
    });

    it("compte tous les cours de la semaine", async () => {
        const result = await SyncService.instance.processEntry(
            timetableEntry({
                getTimetable: async () => ({
                    lessons: [timetableLesson(), timetableLesson(), timetableLesson()],
                }),
            }) as any,
        );

        expect(result.lessonsAdded).toBe(3);
        expect(result.success).toBe(true);
        expect(result.weekNumber).toBe(37);
    });
});

describe("SyncService.formatLesson", () => {
    /** Méthode privée, exercée directement : c'est là que vit l'extraction. */
    function format(lesson: any, fromYear = "A1"): any {
        return (SyncService.instance as any).formatLesson(lesson, fromYear);
    }

    describe("code et intitulé de la matière", () => {
        it("prend le code porté par le contenu", () => {
            expect(format(timetableLesson()).contentCode).toBe("R3.01");
        });

        it("récupère le code dans la description quand il n'est pas typé", () => {
            const formatted = format(
                timetableLesson({
                    content: { description: "Cours R1.01 - Initiation au développement" },
                }),
            );

            expect(formatted.contentCode).toBe("R1.01");
        });

        it("cherche aussi le code dans le libellé brut", () => {
            const formatted = format(
                timetableLesson({ content: { raw_lesson: "S2.04 Exploitation de données" } }),
            );

            expect(formatted.contentCode).toBe("S2.04");
        });

        it("retombe sur N/A quand aucun code n'est repérable", () => {
            const formatted = format(timetableLesson({ content: { description: "Réunion" } }));

            expect(formatted.contentCode).toBe("N/A");
        });

        it("privilégie le libellé de référence sur la description", () => {
            const formatted = format(
                timetableLesson({
                    content: {
                        type: "R3.01",
                        lesson_from_reference: "Développement web avancé",
                        description: "R3.01",
                    },
                }),
            );

            expect(formatted.contentName).toBe("Développement web avancé");
        });

        it("utilise le code comme intitulé en dernier recours", () => {
            const formatted = format(timetableLesson({ content: { type: "R3.01" } }));

            expect(formatted.contentName).toBe("R3.01");
        });

        it("aplatit les retours à la ligne de l'intitulé", () => {
            const formatted = format(
                timetableLesson({ content: { type: "R3.01", description: " Dev\nweb \r\n" } }),
            );

            expect(formatted.contentName).toBe("Dev web");
        });
    });

    describe("salles", () => {
        it("développe une plage de salles en salles distinctes", () => {
            // "111-2" désigne les salles 111 et 112.
            const formatted = format(timetableLesson({
                content: { type: "R3.01", room: "111-2" },
            }));

            expect(formatted.roomNames).toEqual(["111", "112"]);
        });

        it("normalise les amphithéâtres", () => {
            expect(format(timetableLesson({
                content: { type: "R3.01", room: "Amp1" },
            })).roomNames).toEqual(["Amph1"]);

            expect(format(timetableLesson({
                content: { type: "R3.01", room: "A2" },
            })).roomNames).toEqual(["Amph2"]);
        });

        it("laisse une salle ordinaire inchangée", () => {
            expect(format(timetableLesson()).roomNames).toEqual(["S101"]);
        });

        it("accepte un cours sans salle", () => {
            expect(format(timetableLesson({
                content: { type: "R3.01", room: null },
            })).roomNames).toEqual([]);
        });
    });

    describe("enseignant et groupes", () => {
        it("laisse l'enseignant à null quand il n'est pas renseigné", () => {
            expect(format(timetableLesson({
                content: { type: "R3.01", teacher: "" },
            })).teacherName).toBeNull();
        });

        it("rattache le cours à la promo quand aucun groupe n'est précisé", () => {
            const formatted = format(timetableLesson(), "A2");

            // A2 → groupe fictif -2, sous-groupe -1 (promo entière)
            expect(formatted.mainGroup).toBe(-2);
            expect(formatted.subGroup).toBe(-1);
        });

        it("traduit les sous-groupes A et B en 1 et 2", () => {
            // Valeurs fixées par le stub d'Unilim (voir tests/setup.ts).
            expect(format(timetableLesson({ group: { main: 1, sub: "A" } })).subGroup).toBe(1);
            expect(format(timetableLesson({ group: { main: 1, sub: "B" } })).subGroup).toBe(2);
        });

        it("garde le groupe entier quand le cours n'a pas de sous-groupe", () => {
            const formatted = format(timetableLesson({ group: { main: 4 } }));

            expect(formatted.mainGroup).toBe(4);
            expect(formatted.subGroup).toBe(-1);
        });
    });
});
