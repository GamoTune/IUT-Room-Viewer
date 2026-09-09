// ============================================
// 📁 src/types/api.ts
// Contrat des réponses de l'API
// ============================================

/** Toutes les routes renvoient cette enveloppe. */
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}

/** Une salle du référentiel. */
export interface Room {
    id: number;
    name: string;
    floor: number;
    kind: "salle" | "amphi";
    displayOrder: number;
    isActive: boolean;
}

/** Groupes d'un cours, au niveau réellement concerné. */
export interface GroupRef {
    /** Négatif pour une promotion entière : `-1` = A1. */
    mainGroup: number;
    /** `1` = A, `2` = B, `-1` = groupe entier. */
    subGroup: number;
}

/** Un cours, tel que rendu par `/api/v1/rooms/availability`. */
export interface Lesson {
    id: number;
    type: string;
    startTime: string;
    endTime: string;
    rooms: string[];
    teacher: string | null;
    contentCode: string;
    contentName: string;
    groups: GroupRef[];
}

/** Une salle et les cours qui l'occupent sur la période demandée. */
export interface RoomAvailability {
    id: number;
    name: string;
    lessons: Lesson[];
}

/** Un groupe, pour le sélecteur. */
export interface Group {
    code: string;
    label: string;
    year: string;
    mainGroup: number;
    subGroup: string | null;
}

/** Un cours, tel que rendu par `/api/v2/courses`. */
export interface Course {
    code: string;
    title: string;
    type: string;
    rooms: string[];
    groups: string[];
    teacher: string;
    start_at: string;
    end_at: string;
}
