// ============================================
// 📁 src/composables/useRooms.ts
// Occupation des salles à l'instant courant
// ============================================

import { computed, ref, type ComputedRef, type Ref } from "vue";
import { useCachedResource, type Freshness } from "./useCachedResource";
import type { Lesson, Room, RoomAvailability } from "../types/api";

/**
 * Salles physiquement identiques : si l'une est occupée, l'autre l'est aussi.
 * Même règle que le bot Discord — R46 et R47 sont les mêmes locaux.
 */
const ROOM_ALIASES: Record<string, string[]> = {
    R46: ["R46", "R47"],
    R47: ["R46", "R47"],
};

export interface RoomState {
    room: Room;
    /** Cours en cours dans la salle, s'il y en a un seul d'identifiable. */
    lesson: Lesson | null;
    /** Plusieurs cours se chevauchent : la salle est occupée sans détail lisible. */
    busy: boolean;
}

export interface FloorGroup {
    /** Libellé de l'étage : « RDC », « 1er étage »… */
    label: string;
    rooms: RoomState[];
}

const FLOOR_LABELS: Record<number, string> = {
    0: "Rez-de-chaussée",
    1: "1er étage",
    2: "2ème étage",
};

/**
 * Instant consulté. Par défaut l'heure courante, mais un paramètre `at` dans
 * l'URL permet de regarder un autre créneau — l'équivalent du `/salles_entre`
 * du bot, et le seul moyen de vérifier l'affichage hors des heures de cours.
 */
function requestedInstant(): Date {
    const raw = new URLSearchParams(window.location.search).get("at");
    if (!raw) return new Date();

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function useRooms(): {
    floors: ComputedRef<FloorGroup[]>;
    freshness: ComputedRef<Freshness>;
    updatedAt: Ref<number | null>;
    reload: () => Promise<void>;
    instant: Ref<Date>;
} {
    const instant = ref(requestedInstant());

    const rooms = useCachedResource<Room[]>("rooms", () => "/api/v1/rooms");
    const availability = useCachedResource<RoomAvailability[]>("availability", () => {
        const at = instant.value.toISOString();
        return `/api/v1/rooms/availability?startTime=${at}&endTime=${at}`;
    });

    /** Les cours de chaque salle, alias appliqués. */
    const lessonsByRoom = computed(() => {
        const direct = new Map<string, Lesson[]>();
        for (const entry of availability.data.value ?? []) {
            direct.set(entry.name, entry.lessons);
        }

        const merged = new Map<string, Lesson[]>();
        for (const name of direct.keys()) {
            const family = ROOM_ALIASES[name] ?? [name];
            const shared = family.flatMap((member) => direct.get(member) ?? []);
            const unique = [...new Map(shared.map((lesson) => [lesson.id, lesson])).values()];
            merged.set(name, unique);
        }

        return merged;
    });

    const floors = computed<FloorGroup[]>(() => {
        const byFloor = new Map<number, RoomState[]>();

        for (const room of rooms.data.value ?? []) {
            if (!room.isActive) continue;

            const lessons = lessonsByRoom.value.get(room.name) ?? [];
            const state: RoomState = {
                room,
                lesson: lessons.length === 1 ? lessons[0]! : null,
                busy: lessons.length > 0,
            };

            const key = room.kind === "amphi" ? -1 : room.floor;
            const existing = byFloor.get(key);
            if (existing) existing.push(state);
            else byFloor.set(key, [state]);
        }

        return [...byFloor.entries()]
            .sort(([a], [b]) => (a === -1 ? 1 : b === -1 ? -1 : a - b))
            .map(([floor, list]) => ({
                label: floor === -1 ? "Amphithéâtres" : (FLOOR_LABELS[floor] ?? `Étage ${floor}`),
                rooms: list.sort((a, b) => a.room.displayOrder - b.room.displayOrder),
            }));
    });

    // L'état le moins avancé des deux requêtes décrit l'écran
    const freshness = computed<Freshness>(() => {
        const states = [rooms.freshness.value, availability.freshness.value];
        if (states.includes("error")) return "error";
        if (states.includes("revalidating")) return "revalidating";
        if (states.includes("stale")) return "stale";
        return "fresh";
    });

    const reload = async (): Promise<void> => {
        instant.value = requestedInstant();
        await Promise.all([rooms.reload(), availability.reload()]);
    };

    return { floors, freshness, updatedAt: availability.updatedAt, reload, instant };
}
