// ============================================
// 📁 tests/helpers/fixtures.ts
// Jeux de données réutilisés par les tests
// ============================================

import type { CourseResult } from "../../src/types/course.types.js";
import type { LessonFull, RoomWithLessons } from "../../src/types/lesson.types.js";

/** Un cours tel que le renvoie `CourseRepository.findMany` (API v2). */
export function courseResult(overrides: Partial<CourseResult> = {}): CourseResult {
    return {
        id: 1,
        type: "TP",
        start_datetime: new Date("2026-09-07T08:00:00.000Z"),
        end_datetime: new Date("2026-09-07T10:00:00.000Z"),
        content_id: 10,
        teacher_id: 20,
        edt_id: 30,
        content: { id: 10, code: "R3.01", name: "Développement web" },
        teacher: { id: 20, name: "Hugel T." },
        lesson_room: [
            { lesson_id: 1, room_id: 40, room: { id: 40, name: "S101" } },
        ],
        lesson_group: [
            { lesson_id: 1, group_id: 50, group: { name: "G1A" } },
        ],
        ...overrides,
    };
}

/** Un cours complet tel que le renvoie le repository des salles (API v1). */
export function lessonFull(overrides: Partial<LessonFull> = {}): LessonFull {
    return {
        id: 1,
        type: "CM",
        start_datetime: new Date("2026-09-07T08:00:00.000Z"),
        end_datetime: new Date("2026-09-07T10:00:00.000Z"),
        content_id: 10,
        teacher_id: 20,
        edt_id: 30,
        content: { id: 10, code: "R3.01", name: "Développement web" },
        teacher: { id: 20, name: "Hugel T." },
        lesson_room: [
            { lesson_id: 1, room_id: 40, room: { id: 40, name: "S101" } },
        ],
        lesson_group: [
            {
                lesson_id: 1,
                group_id: 50,
                group: { id: 50, main_group: 1, sub_group: 1 },
            },
        ],
        ...overrides,
    } as LessonFull;
}

/** Une salle avec ses cours, format `RoomRepository.findAllRoomsWithLessonsInTimeRange`. */
export function roomWithLessons(overrides: Partial<RoomWithLessons> = {}): RoomWithLessons {
    return {
        id: 40,
        name: "S101",
        lesson_room: [
            { lesson_id: 1, room_id: 40, lesson: lessonFull() },
        ],
        ...overrides,
    } as RoomWithLessons;
}
