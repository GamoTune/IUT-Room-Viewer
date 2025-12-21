// ============================================
// 📁 src/types/api.types.ts
// API response type definitions
// ============================================

/**
 * Lesson in API response format
 */
export interface LessonResponse {
    id: number;
    type: string;
    startTime: string;
    endTime: string;
    rooms: string[];  // Array of room names (many-to-many)
    teacher: string | null;
    contentCode: string;
    contentName: string;
    groups: Array<{ mainGroup: number; subGroup: number }>;
}

/**
 * Room with lessons response
 */
export interface RoomWithLessonsResponse {
    id: number;
    name: string;
    lessons: LessonResponse[];
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}

/**
 * Room availability API response
 */
export type RoomsAvailabilityResponse = ApiResponse<RoomWithLessonsResponse[]>;
