// ============================================
// 📁 src/services/api.service.ts
// API client for fetching data from the server
// ============================================

import type { RoomsAvailabilityResponse, RoomWithLessonsResponse, CoursesApiParams, CoursesApiResponse, Course } from "../types/index.js";

const API_URL = process.env.API_URL || "http://localhost:3000";

/**
 * Service for making API calls to the server
 */
export class ApiService {
    private static _instance: ApiService;

    static get instance(): ApiService {
        if (!ApiService._instance) {
            ApiService._instance = new ApiService();
        }
        return ApiService._instance;
    }

    /**
     * Get rooms availability for a time range
     */
    async getRoomsAvailability(startTime: Date, endTime: Date): Promise<RoomWithLessonsResponse[]> {
        const url = `${API_URL}/api/v1/rooms/availability?startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`;
        console.log(`Fetching rooms availability from URL: ${url}`);

        const response = await fetch(url);

    
        const data = (await response.json()) as RoomsAvailabilityResponse;

        if (!data.success) {
            throw new Error(data.error || "Failed to fetch room availability");
        }

        return data.data;
    }

    /**
     * Trigger a manual sync
     */
    async triggerSync(): Promise<void> {
        const response = await fetch(`${API_URL}/api/v1/sync/trigger`, {
            method: "POST",
        });

        if (!response.ok) {
            throw new Error("Failed to trigger sync");
        }
    }

    /**
     * Get all courses for a given time range and optional filters
     */
    async getCourses(params: CoursesApiParams): Promise<Course[]> {
        const start_at: Date = params.startAt;
        const end_at: Date = params.endAt;
        const groups: string | undefined = params.groups ? params.groups.join(",") : undefined;
        const rooms: string | undefined = params.rooms ? params.rooms.join(",") : undefined;
        const teachers: string | undefined = params.teachers ? params.teachers.join(",") : undefined;
        const url = `${API_URL}/api/v2/courses?start_at=${start_at.toISOString()}&end_at=${end_at.toISOString()}${groups ? `&groups=${groups}` : ""}${rooms ? `&rooms=${rooms}` : ""}${teachers ? `&teachers=${teachers}` : ""}`;
        
        const response = await fetch(url);
        const data = (await response.json()) as CoursesApiResponse;

        console.log(data.data);

        if (!data.success) {
            throw new Error(data.error || "Failed to fetch courses");
        }

        return data.data;
    }

    }
