/**
 * Schedule Types
 */
export interface Course {
    id: number;
    title: string;
    startTime: string; // ISO 8601
    endTime: string;   // ISO 8601
    room: string;
    teacher?: string;
    type?: 'CM' | 'TD' | 'TP' | 'DS' | 'SAE' | 'Autre';
}
export interface ScheduleQuery {
    group: string;      // e.g., "G3", "G5" - Le numéro déduit l'année automatiquement
    tp?: string;        // e.g., "A", "B"
    date?: string;      // ISO date, default: today
}
export interface ScheduleResponse {
    group: string;
    year: string;
    tp?: string;
    date: string;
    courses: Course[];
}