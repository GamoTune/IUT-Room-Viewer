// ============================================
// 📁 src/types/lesson.types.ts
// Types métier et formats de réponse de l'API
// ============================================

import type { Lesson } from "../entities/lesson.entity.js";
import type { Room } from "../entities/room.entity.js";
import type { StudentGroup } from "../entities/studentGroup.entity.js";

export type { Room } from "../entities/room.entity.js";
export type { Teacher } from "../entities/teacher.entity.js";
export type { Subject } from "../entities/subject.entity.js";
export type { StudentGroup } from "../entities/studentGroup.entity.js";
export type { Lesson } from "../entities/lesson.entity.js";
export type { EdtSource } from "../entities/edtSource.entity.js";

/** Un cours chargé avec tout ce qu'il faut pour le présenter. */
export type LessonWithRelations = Lesson;

/** Une salle et les cours qui l'occupent sur une période. */
export interface RoomWithLessons {
    room: Room;
    lessons: Lesson[];
}

/** Groupes d'un cours, tels qu'attendus par le bot. */
export interface GroupRef {
    mainGroup: number;
    subGroup: number;
}

/** Version JSON d'un cours (dates en ISO string) */
export interface LessonResponse {
    id: number;
    type: string;
    startTime: string;
    endTime: string;
    rooms: string[];  // Tableau de noms de salles (many-to-many)
    teacher: string | null;
    contentCode: string;
    contentName: string;
    groups: GroupRef[];
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

/** Groupes d'un cours, pour l'agrégation en niveaux d'affichage. */
export type LessonGroups = StudentGroup[];
