// ============================================
// 📁 src/sync/sync.repository.ts
// Couche d'accès aux données pour la synchronisation
// ============================================

import prisma from "../lib/prismaEDT.js";

/**
 * Repository pour les opérations de synchronisation en base de données
 */
export class SyncRepository {
    public static instance: SyncRepository = new SyncRepository();

    // ============================================
    // EDT Index
    // ============================================

    /**
     * Trouve un EDT par numéro de semaine et année
     */
    async findEdtByWeekAndYear(weekNumber: number, fromYear: string) {
        return prisma.edt_index.findFirst({
            where: { week_number: weekNumber, from_year: fromYear }
        });
    }

    /**
     * Crée ou met à jour un index EDT
     */
    async upsertEdt(data: {
        weekNumber: number;
        fromYear: string;
        link: string;
        lastUpdated: Date;
    }) {
        const existing = await this.findEdtByWeekAndYear(data.weekNumber, data.fromYear);

        if (existing) {
            return prisma.edt_index.update({
                where: { id: existing.id },
                data: {
                    link: data.link,
                    last_updated: data.lastUpdated,
                }
            });
        }

        return prisma.edt_index.create({
            data: {
                week_number: data.weekNumber,
                from_year: data.fromYear,
                link: data.link,
                last_updated: data.lastUpdated,
            }
        });
    }

    // ============================================
    // Content (Matières)
    // ============================================

    /**
     * Crée ou récupère une matière par son code
     */
    async upsertContent(code: string, name: string) {
        return prisma.content.upsert({
            where: { code },
            update: { name },
            create: { code, name }
        });
    }

    // ============================================
    // Teacher (Professeurs)
    // ============================================

    /**
     * Crée ou récupère un professeur par son nom
     */
    async upsertTeacher(name: string) {
        return prisma.teacher.upsert({
            where: { name },
            update: {},
            create: { name }
        });
    }

    // ============================================
    // Room (Salles)
    // ============================================

    /**
     * Crée ou récupère une salle par son nom
     */
    async upsertRoom(name: string) {
        return prisma.room.upsert({
            where: { name },
            update: {},
            create: { name }
        });
    }

    // ============================================
    // Student Group (Groupes)
    // ============================================

    /**
     * Crée ou récupère un groupe étudiant
     */
    async upsertStudentGroup(mainGroup: number, subGroup: number) {
        return prisma.student_group.upsert({
            where: {
                main_group_sub_group: { main_group: mainGroup, sub_group: subGroup }
            },
            update: {},
            create: { main_group: mainGroup, sub_group: subGroup }
        });
    }

    // ============================================
    // Lesson (Cours)
    // ============================================

    /**
     * Crée ou met à jour un cours (upsert pour gérer les doublons dans les données sources)
     */
    async upsertLesson(data: {
        type: string;
        startDatetime: Date;
        endDatetime: Date;
        contentId: number;
        roomId: number | null;
        teacherId: number | null;
        edtId: number;
    }) {
        // Chercher si le cours existe déjà avec les mêmes caractéristiques
        const existing = await prisma.lesson.findFirst({
            where: {
                type: data.type,
                start_datetime: data.startDatetime,
                end_datetime: data.endDatetime,
                content_id: data.contentId,
                room_id: data.roomId,
                teacher_id: data.teacherId,
                edt_id: data.edtId,
            }
        });

        if (existing) {
            return existing; // Déjà existant, on le retourne
        }

        return prisma.lesson.create({
            data: {
                type: data.type,
                start_datetime: data.startDatetime,
                end_datetime: data.endDatetime,
                content_id: data.contentId,
                room_id: data.roomId,
                teacher_id: data.teacherId,
                edt_id: data.edtId,
            }
        });
    }

    /**
     * Lie un cours à un groupe d'étudiants
     */
    async linkLessonToGroup(lessonId: number, groupId: number) {
        return prisma.lesson_group.upsert({
            where: {
                lesson_id_group_id: { lesson_id: lessonId, group_id: groupId }
            },
            update: {},
            create: { lesson_id: lessonId, group_id: groupId }
        });
    }

    /**
     * Supprime tous les cours liés à un EDT (cascade manuelle)
     */
    async deleteLessonsByEdtId(edtId: number) {
        // 1. Récupérer les IDs des lessons
        const lessons = await prisma.lesson.findMany({
            where: { edt_id: edtId },
            select: { id: true }
        });
        const lessonIds = lessons.map(l => l.id);

        if (lessonIds.length === 0) return 0;

        // 2. Supprimer les liaisons lesson_group
        await prisma.lesson_group.deleteMany({
            where: { lesson_id: { in: lessonIds } }
        });

        // 3. Supprimer les lessons
        const result = await prisma.lesson.deleteMany({
            where: { id: { in: lessonIds } }
        });

        return result.count;
    }
}
