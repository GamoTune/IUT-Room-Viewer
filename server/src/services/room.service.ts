// ============================================
// 📁 src/services/room.service.ts
// Logique métier pour les salles
// ============================================

import lessonRepository from "../repository/lesson.repository.js";
import { toLessonResponse } from "./lesson.mapper.js";
import type { Room, RoomWithLessonsResponse } from "../types/index.js";

/**
 * Service pour la logique métier des salles
 */
export class RoomService {
    public static instance: RoomService = new RoomService();

    /**
     * Récupère toutes les salles, dans l'ordre d'affichage (étage puis numéro)
     */
    async getAllRooms(): Promise<Room[]> {
        return lessonRepository.findAllRooms();
    }

    /**
     * Récupère les salles avec les cours qui les occupent sur une période donnée.
     *
     * Toutes les salles du référentiel sont renvoyées, y compris celles sans
     * cours : une salle libre est une information, pas une absence.
     */
    async getRoomsAvailability(startTime: Date, endTime: Date): Promise<RoomWithLessonsResponse[]> {
        const [rooms, lessons, census] = await Promise.all([
            lessonRepository.findAllRooms(),
            lessonRepository.findMany({ from: startTime, to: endTime, mode: "overlap" }),
            lessonRepository.loadGroupCensus(),
        ]);

        // Un cours peut occuper deux salles à la fois (`108-9`)
        const lessonsByRoom = new Map<number, ReturnType<typeof toLessonResponse>[]>();

        for (const lesson of lessons) {
            const response = toLessonResponse(lesson, census);

            for (const room of lesson.rooms ?? []) {
                const existing = lessonsByRoom.get(room.id);
                if (existing) existing.push(response);
                else lessonsByRoom.set(room.id, [response]);
            }
        }

        return rooms.map((room) => ({
            id: room.id,
            name: room.name,
            lessons: lessonsByRoom.get(room.id) ?? [],
        }));
    }
}
