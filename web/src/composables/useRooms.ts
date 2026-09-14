// ============================================
// 📁 src/composables/useRooms.ts
// Occupation des salles sur le créneau consulté
// ============================================

import { computed, type ComputedRef } from "vue";
import { useCachedResource, type Freshness } from "./useCachedResource";
import { concernsGroup } from "./groupMatch";
import type { RoomWindow } from "./useRoomWindow";
import type { Group, Lesson, Room, RoomAvailability } from "../types/api";

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
    /** Cours occupant la salle sur le créneau, dans l'ordre chronologique. */
    lessons: Lesson[];
    busy: boolean;
    /** Un de ces cours est celui du groupe consulté : c'est ma salle. */
    mine: boolean;
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

export function useRooms(consulted: ComputedRef<RoomWindow>, group: ComputedRef<Group | null>): {
    floors: ComputedRef<FloorGroup[]>;
    freshness: ComputedRef<Freshness>;
    updatedAt: ComputedRef<number | null>;
    reload: () => Promise<void>;
} {
    const rooms = useCachedResource<Room[]>("rooms", () => "/api/v1/rooms");

    /** Requête du créneau courant. En direct, l'instant est relu à chaque appel. */
    const path = (): string => {
        const asked = consulted.value;
        const from = asked.live ? new Date() : asked.from;
        const to = asked.live ? from : asked.to;
        return `/api/v1/rooms/availability?startTime=${from.toISOString()}&endTime=${to.toISOString()}`;
    };

    // Une instance par créneau : revenir sur un créneau déjà consulté réaffiche
    // immédiatement son cache, au lieu d'attendre le réseau.
    const instances = new Map<string, ReturnType<typeof useCachedResource<RoomAvailability[]>>>();

    const availability = computed(() => {
        const key = consulted.value.key;
        const existing = instances.get(key);
        if (existing) return existing;

        const created = useCachedResource<RoomAvailability[]>(`availability:${key}`, path);
        instances.set(key, created);
        return created;
    });

    /** Les cours de chaque salle, alias appliqués. */
    const lessonsByRoom = computed(() => {
        const direct = new Map<string, Lesson[]>();
        for (const entry of availability.value.data.value ?? []) {
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

            const lessons = [...(lessonsByRoom.value.get(room.name) ?? [])].sort((a, b) =>
                a.startTime.localeCompare(b.startTime),
            );
            const state: RoomState = {
                room,
                lessons,
                busy: lessons.length > 0,
                mine: lessons.some((lesson) => concernsGroup(lesson.groups, group.value)),
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
        const states = [rooms.freshness.value, availability.value.freshness.value];
        if (states.includes("error")) return "error";
        if (states.includes("revalidating")) return "revalidating";
        if (states.includes("stale")) return "stale";
        return "fresh";
    });

    const reload = async (): Promise<void> => {
        await Promise.all([rooms.reload(), availability.value.reload()]);
    };

    return {
        floors,
        freshness,
        updatedAt: computed(() => availability.value.updatedAt.value),
        reload,
    };
}
