// ============================================
// 📁 src/sync/sync.service.ts
// Logique métier pour la synchronisation avec Unilim
// ============================================

import {
    OnlineTimetable,
    TimetableYear,
    LESSON_TYPES,
    SUBGROUPS,
    type TimetableLesson,
    type OnlineTimetableFileEntry,
} from "unilim/iut/cs/timetable";

import { SyncRepository } from "../repository/sync.repository.js";
import type { SyncResult, SyncSummary, SyncStatus, FormattedLesson } from "../types/sync.types.js";

// Mapping des années vers des identifiants numériques (pour la BDD)
const YEAR_TO_MAIN_GROUP: Record<TimetableYear, number> = {
    [TimetableYear.A1]: -1,
    [TimetableYear.A2]: -2,
    [TimetableYear.A3]: -3,
};

/**
 * Service de synchronisation avec la librairie Unilim
 * Gère la logique de récupération et mise à jour des emplois du temps
 */
export class SyncService {
    public static instance: SyncService = new SyncService();

    private status: SyncStatus = {
        isRunning: false,
        lastSync: null,
    };

    /**
     * Retourne le statut actuel de la synchronisation
     */
    getStatus(): SyncStatus {
        return this.status;
    }

    /**
     * Réinitialise la synchronisation : supprime tous les EDT pour forcer une re-sync complète
     */
    async reset(): Promise<number> {
        // Supprimer tous les EDT (cascade vers lessons)
        const deletedCount = await SyncRepository.instance.deleteAllEdts();

        // Réinitialiser le statut en mémoire
        this.status = {
            isRunning: false,
            lastSync: null,
        };

        console.log(`🗑️ Reset: ${deletedCount} EDT supprimés`);
        return deletedCount;
    }

    /**
     * Synchronise tous les emplois du temps (A1, A2, A3)
     */
    async syncAll(): Promise<SyncSummary> {
        if (this.status.isRunning) {
            throw new Error("Une synchronisation est déjà en cours");
        }

        this.status.isRunning = true;
        const startedAt = new Date();
        const results: SyncResult[] = [];
        const errors: string[] = [];

        console.log("🔄 Synchronisation automatique démarrée...");

        try {
            // Synchroniser chaque année
            for (const year of [TimetableYear.A1, TimetableYear.A2, TimetableYear.A3]) {
                try {
                    const yearResults = await this.syncYear(year);
                    results.push(...yearResults);
                } catch (error) {
                    const errorMsg = `Erreur lors de la sync ${year}: ${error}`;
                    console.error(errorMsg);
                    errors.push(errorMsg);
                }
            }

            const summary: SyncSummary = {
                success: errors.length === 0,
                startedAt,
                completedAt: new Date(),
                totalEdtProcessed: results.filter(r => !r.skipped).length,
                totalEdtSkipped: results.filter(r => r.skipped).length,
                totalLessonsProcessed: results.reduce((acc, r) => acc + r.lessonsAdded, 0),
                errors,
            };

            this.status.lastSync = summary;
            console.log(`✅ Synchronisation terminée: ${summary.totalEdtProcessed} EDT traités, ${summary.totalEdtSkipped} skippés, ${summary.totalLessonsProcessed} cours`);

            return summary;
        } finally {
            this.status.isRunning = false;
        }
    }

    /**
     * Synchronise une année spécifique
     */
    async syncYear(year: TimetableYear): Promise<SyncResult[]> {
        console.log(`📅 Synchronisation ${year}...`);

        // Récupérer toutes les entrées d'emploi du temps pour cette année
        const entries = await OnlineTimetable.getTimetableEntries(year);
        const results: SyncResult[] = [];

        for (const entry of entries) {
            const result = await this.processEntry(entry);
            results.push(result);
        }

        return results;
    }

    /**
     * Traite une entrée d'emploi du temps
     */
    async processEntry(entry: OnlineTimetableFileEntry): Promise<SyncResult> {
        const weekNumber = entry.weekNumber;
        const fromYear = entry.fromYear;
        const lastUpdated = entry.lastUpdated.toJSDate();

        // Vérifier si l'EDT existe déjà et s'il est à jour
        const existingEdt = await SyncRepository.instance.findEdtByWeekAndYear(
            weekNumber,
            fromYear
        );

        if (existingEdt && existingEdt.last_updated >= lastUpdated) {
            console.log(`   ⏭️  EDT semaine ${weekNumber} (${fromYear}) déjà à jour, skip`);
            return {
                success: true,
                year: entry.fromYear as TimetableYear,
                weekNumber,
                lessonsAdded: 0,
                lessonsUpdated: 0,
                skipped: true,
                message: "EDT déjà à jour",
            };
        }

        console.log(`   📥 Téléchargement EDT semaine ${weekNumber} (${fromYear})...`);

        // Télécharger le timetable
        const timetable = await entry.getTimetable();

        // Créer ou mettre à jour l'index EDT
        const edtRecord = await SyncRepository.instance.upsertEdt({
            weekNumber,
            fromYear,
            link: entry.url.toString(),
            lastUpdated,
        });

        // Si l'EDT existait, supprimer les anciens cours
        if (existingEdt) {
            const deletedCount = await SyncRepository.instance.deleteLessonsByEdtId(edtRecord.id);
            console.log(`   🗑️  ${deletedCount} anciens cours supprimés`);
        }

        // Formater et insérer les nouvelles lessons
        let lessonsAdded = 0;
        for (const lesson of timetable.lessons) {
            await this.processLesson(lesson, edtRecord.id, entry.fromYear);
            lessonsAdded++;
        }

        console.log(`   ✅ ${lessonsAdded} cours ajoutés pour semaine ${weekNumber}`);

        return {
            success: true,
            year: entry.fromYear as TimetableYear,
            weekNumber,
            lessonsAdded,
            lessonsUpdated: 0,
            skipped: false,
            message: `${lessonsAdded} cours synchronisés`,
        };
    }

    /**
     * Traite un cours individuel et l'insère en BDD
     */
    private async processLesson(
        lesson: TimetableLesson,
        edtId: number,
        fromYear: TimetableYear
    ): Promise<void> {
        const formatted = this.formatLesson(lesson, fromYear);

        // Upsert du contenu (matière)
        const content = await SyncRepository.instance.upsertContent(
            formatted.contentCode,
            formatted.contentName
        );

        // Upsert du professeur (si présent)
        let teacherId: number | null = null;
        if (formatted.teacherName) {
            const teacher = await SyncRepository.instance.upsertTeacher(formatted.teacherName);
            teacherId = teacher.id;
        }

        // Créer le cours (sans roomId, géré via lesson_room)
        const lessonRecord = await SyncRepository.instance.upsertLesson({
            type: formatted.type,
            startDatetime: formatted.startDatetime,
            endDatetime: formatted.endDatetime,
            contentId: content.id,
            teacherId,
            edtId,
        });

        // Lier le cours aux salles (many-to-many via lesson_room)
        for (const roomName of formatted.roomNames) {
            const room = await SyncRepository.instance.upsertRoom(roomName);
            await SyncRepository.instance.linkLessonToRoom(lessonRecord.id, room.id);
        }

        // Créer le groupe et le lier au cours
        const group = await SyncRepository.instance.upsertStudentGroup(
            formatted.mainGroup,
            formatted.subGroup
        );
        await SyncRepository.instance.linkLessonToGroup(lessonRecord.id, group.id);
    }

    /**
     * Formate une lesson Unilim vers le format BDD
     */
    private formatLesson(lesson: TimetableLesson, fromYear: TimetableYear): FormattedLesson {
        // Extraire les données communes
        const startDatetime = lesson.start_date.toJSDate();
        const endDatetime = lesson.end_date.toJSDate();
        const type = lesson.type;

        // Extraire le contenu selon le type
        let contentCode = "N/A";
        let contentName = "N/A";
        let teacherName: string | null = null;
        let roomNames: string[] = [];

        if ("content" in lesson) {
            const content = lesson.content;
            teacherName = content.teacher || null;
            roomNames = this.formatRoomNames(content.room || null);

            if ("type" in content) {
                contentCode = content.type;
            }
            if ("lesson_from_reference" in content && content.lesson_from_reference) {
                contentName = content.lesson_from_reference;
            } else if ("description" in content) {
                contentName = content.description || "N/A";
            } else if ("raw_lesson" in content) {
                contentName = content.raw_lesson || "N/A";
            }
        }

        // Extraire le groupe selon le type de cours
        let mainGroup = YEAR_TO_MAIN_GROUP[fromYear]; // Par défaut : toute l'année
        let subGroup = -1; // -1 = pas de sous-groupe

        if ("group" in lesson && lesson.group !== undefined) {
            mainGroup = lesson.group.main;
            if ("sub" in lesson.group && lesson.group.sub !== undefined) {
                // SUBGROUPS.A = 0 → 1, SUBGROUPS.B = 1 → 2
                subGroup = lesson.group.sub === SUBGROUPS.A ? 1 : 2;
            }
        }

        return {
            type,
            startDatetime,
            endDatetime,
            contentCode,
            contentName,
            teacherName,
            roomNames,
            mainGroup,
            subGroup,
        };
    }

    /**
     * Formate le nom de la salle (normalisation + gestion multi-salles)
     * Gère le format "111-2" → ["111", "112"] (salle 111 et fin 2 = 112)
     */
    private formatRoomNames(room: string | null): string[] {
        if (!room) return [];

        // Gérer les ranges de salles (ex: "111-2" → "111" et "112")
        if (room.includes("-")) {
            const parts = room.split("-");
            const roomBase = parts[0];
            const roomSuffix = parts[1];

            // Calculer la deuxième salle (ex: 111 + 1 = 112 si suffix est "2")
            const baseNum = parseInt(roomBase);
            const secondRoom = (baseNum + 1).toString();

            // Normaliser les deux salles
            return [
                this.normalizeRoomName(roomBase),
                this.normalizeRoomName(secondRoom),
            ].filter(r => r !== null) as string[];
        }

        // Salle unique
        const normalized = this.normalizeRoomName(room);
        return normalized ? [normalized] : [];
    }

    /**
     * Normalise un nom de salle individuel (amphithéâtres, etc.)
     */
    private normalizeRoomName(room: string): string | null {
        if (!room) return null;

        // Normaliser les amphithéâtres
        if (room.includes("A") || room.includes("Amp")) {
            if (room.includes("Amp")) {
                return "Amph" + room.charAt(3);
            } else if (room.length >= 2 && room.charAt(0) === "A") {
                return "Amph" + room.charAt(1);
            }
        }

        return room;
    }
}

