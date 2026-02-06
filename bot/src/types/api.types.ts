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


/**
 * Courses API parameters
 */
export interface CoursesApiParams {
    startAt: Date;
    endAt: Date;
    groups?: string[]; // Optional array of group names
    rooms?: string[];  // Optional array of room names
    teachers?: string[]; // Optional array of teacher names
}

export interface CoursesApiResponse {
    success: boolean;
    data: Course[];
    error?: string;
}