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
     * Supprime tous les EDT (cascade vers les lessons via onDelete)
     * Utilisé pour forcer une re-synchronisation complète
     */
    async deleteAllEdts() {
        // Les lessons sont automatiquement supprimées grâce à onDelete: Cascade
        const result = await prisma.edt_index.deleteMany({});
        return result.count;
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
     * Crée ou met à jour un cours (sans roomId, géré via lesson_room)
     */
    async upsertLesson(data: {
        type: string;
        startDatetime: Date;
        endDatetime: Date;
        contentId: number;
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
     * Lie un cours à une salle (many-to-many via lesson_room)
     */
    async linkLessonToRoom(lessonId: number, roomId: number) {
        return prisma.lesson_room.upsert({
            where: {
                lesson_id_room_id: { lesson_id: lessonId, room_id: roomId }
            },
            update: {},
            create: { lesson_id: lessonId, room_id: roomId }
        });
    }

    /**
     * Supprime tous les cours liés à un EDT (les cascades gèrent lesson_group et lesson_room)
     */
    async deleteLessonsByEdtId(edtId: number) {
        // Avec onDelete: Cascade sur lesson_group et lesson_room,
        // la suppression des lessons supprimera automatiquement les liaisons
        const result = await prisma.lesson.deleteMany({
            where: { edt_id: edtId }
        });

        return result.count;
    }
}

