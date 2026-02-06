// ============================================
// 📁 src/repository/course.repository.ts
// Couche d'accès aux données pour les cours
// ============================================

import prisma from "../lib/prismaEDT.js";

import { CourseResult } from "../types/course.types.js";
import { GET_COURSES_REPOSITORY_PARAMS } from "../services/course.service.js";

/**
 * Repository pour les opérations sur les salles
 */
export class CourseRepository {
    public static instance: CourseRepository = new CourseRepository();

    /**
     * Récupère toutes les salles
     */
    async findMany(params: GET_COURSES_REPOSITORY_PARAMS): Promise<CourseResult[]> {
        return prisma.lesson.findMany({
            where: {
                start_datetime: { gte: params.start_at },
                end_datetime: { lte: params.end_at },
                lesson_group: {
                    some: {
                        group: {
                            name: params.groups ? { in: params.groups } : { not: undefined }
                        },
                    },
                },
                lesson_room: {
                    some: {
                        room: {
                            name: params.rooms ? { in: params.rooms } : { not: undefined }
                        },
                    },
                },
                teacher: {
                    name: params.teachers ? { in: params.teachers } : { not: undefined }
                }
            },
            
            include: {
                content: true,
                teacher: true,
                lesson_room: {
                    include: {
                        room: true
                    }
                },
                lesson_group: {
                    include: {
                        group: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { start_datetime: 'asc' },
        })
    }

    /**
     * Récupère tous les professeurs
     */
    async findAllTeachers() {
        return prisma.teacher.findMany({
            select: { id: true, name: true }
        });
    }
}