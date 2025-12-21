// ============================================
// 📁 src/services/room.service.ts
// Logique métier pour les salles
// ============================================

// On importe le repository (accès BDD)
import { RoomRepository } from "../repository/room.repository.js";

// On importe les types
import type { Room, RoomWithLessons, RoomWithLessonsResponse, LessonFull, LessonResponse } from "../types/index.js";

/**
 * Service pour la logique métier des salles
 * 
 * Un service contient la LOGIQUE MÉTIER.
 * Il utilise les repositories pour accéder aux données.
 */
export class RoomService {
    public static instance: RoomService = new RoomService();

    /**
     * Récupère toutes les salles
     */
    async getAllRooms(): Promise<Room[]> {
        return RoomRepository.instance.findAll();
    }

    /**
     * Récupère les salles avec les cours correspondants, sur une période donnée
     */
    async getRoomsAvailability(startTime: Date, endTime: Date): Promise<RoomWithLessonsResponse[]> {
        const rooms = await RoomRepository.instance.findAllRoomsWithLessonsInTimeRange(startTime, endTime);
        if (!rooms) {
            return [];
        }
        return rooms.map(room => this.transformRoomToResponse(room));
    }

    /**
     * Transforme une salle avec ses cours en format de réponse API
     */
    private transformRoomToResponse(room: RoomWithLessons): RoomWithLessonsResponse {
        return {
            id: room.id,
            name: room.name,
            lessons: room.lesson.map(lesson => this.transformLessonToResponse(lesson)),
        };
    }

    /**
     * Transforme un cours complet en format de réponse API
     */
    private transformLessonToResponse(lesson: LessonFull): LessonResponse {
        return {
            id: lesson.id,
            type: lesson.type,
            startTime: lesson.start_datetime.toISOString(),
            endTime: lesson.end_datetime.toISOString(),
            room: lesson.room?.name ?? null,
            teacher: lesson.teacher?.name ?? null,
            contentCode: lesson.content.code,
            contentName: lesson.content.name,
            groups: lesson.lesson_group.map(lg => ({
                mainGroup: lg.group.main_group,
                subGroup: lg.group.sub_group,
            })),
        };
    }
}
