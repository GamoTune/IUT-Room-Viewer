// ============================================
// 📁 src/types/course.controller.ts
// Contrôleur pour les cours (handlers Express)
// ============================================


// ============================================
// Types pour les réponses de l'API

export interface Course {
    code: string;
    title: string;
    type: string;
    rooms: string[];
    groups: string[];
    teacher: string;
    start_at: string; // ISO date string
    end_at: string;   // ISO date string
}


export interface CourseResult {
    id: number;
    type: string;
    start_datetime: Date;
    end_datetime: Date;
    content_id: number;
    teacher_id: number | null;
    edt_id: number | null;
    content: {
        id: number;
        code: string;
        name: string;
    };
    teacher: {
        id: number;
        name: string | null;
    } | null;
    lesson_room: {
        lesson_id: number;
        room_id: number;
        room: {
            id: number;
            name: string;
        };
    }[];
    lesson_group: {
        lesson_id: number;
        group_id: number;
        group: {
            name: string | null;
        };
    }[];
}