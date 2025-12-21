// ============================================
// 📁 src/repository/room.repository.ts
// Couche d'accès aux données pour les salles
// ============================================

import prisma from "../lib/prismaEDT.js";
import type { Room, RoomWithLessons } from "../types/index.js";
import { lessonFullInclude } from "../types/index.js";

/**
 * Repository pour les opérations sur les salles
 */
export class RoomRepository {
    public static instance: RoomRepository = new RoomRepository();

    /**
     * Récupère toutes les salles
     */
    async findAll(): Promise<Room[]> {
        return prisma.room.findMany({
            orderBy: { name: "asc" },
        });
    }

    /**
     * Récupère une salle par son nom
     */
    async findByName(name: string): Promise<Room | null> {
        return prisma.room.findUnique({
            where: { name },
        });
    }

    /**
     * Récupère toutes les salles avec leurs cours sur une période donnée
     */
    async findAllRoomsWithLessonsInTimeRange(startTime: Date, endTime: Date): Promise<RoomWithLessons[]> {
        return prisma.room.findMany({
            include: {
                lesson: {
                    where: {
                        start_datetime: { lt: endTime },
                        end_datetime: { gt: startTime },
                    },
                    ...lessonFullInclude,
                    orderBy: { start_datetime: "asc" },
                },
            },
            orderBy: { name: "asc" },
        });
    }
}