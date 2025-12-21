// ============================================
// 📁 src/types/lesson.types.ts
// Types simplifiés avec inférence Prisma
// ============================================

import { Prisma } from "../../generated/edt-client/client.js";

// ============================================
// Types de base (réexportés depuis Prisma)
// ============================================

export type {
    room as Room,
    teacher as Teacher,
    content as Content,
    student_group as StudentGroup,
    lesson as Lesson,
    lesson_group as LessonGroup,
    edt_index as EdtIndex,
} from "../../generated/edt-client/client.js";

// ============================================
// Définition des "includes" Prisma
// ============================================

// Include pour un cours avec toutes ses relations
export const lessonFullInclude = Prisma.validator<Prisma.lessonDefaultArgs>()({
    include: {
        content: true,
        room: true,
        teacher: true,
        lesson_group: { include: { group: true } },
    },
});

// Include pour une salle avec ses cours
export const roomWithLessonsInclude = Prisma.validator<Prisma.roomDefaultArgs>()({
    include: {
        lesson: {
            include: {
                content: true,
                room: true,
                teacher: true,
                lesson_group: { include: { group: true } },
            },
        },
    },
});

// ============================================
// Types enrichis (inférés automatiquement !)
// ============================================

/** Un cours avec toutes ses relations */
export type LessonFull = Prisma.lessonGetPayload<typeof lessonFullInclude>;

/** Une salle avec ses cours */
export type RoomWithLessons = Prisma.roomGetPayload<typeof roomWithLessonsInclude>;

// ============================================
// Types API (format JSON pour les réponses)
// ============================================

/** Version JSON d'un cours (dates en ISO string) */
export interface LessonResponse {
    id: number;
    type: string;
    startTime: string;
    endTime: string;
    room: string | null;
    teacher: string | null;
    contentCode: string;
    contentName: string;
    groups: Array<{ mainGroup: number; subGroup: number }>;
}

/** Réponse API pour une salle avec ses cours */
export interface RoomWithLessonsResponse {
    id: number;
    name: string;
    lessons: LessonResponse[];
}

/** Statut d'une salle (pour le bot Discord) */
export interface RoomStatusResponse {
    room: { id: number; name: string };
    isOccupied: boolean;
    currentLesson: LessonResponse | null;
    nextLesson: LessonResponse | null;
}

/** EDT d'un groupe */
export interface GroupScheduleResponse {
    group: { id: number; mainGroup: number; subGroup: number };
    period: { start: string; end: string };
    lessons: LessonResponse[];
}