// ============================================
// 📁 src/composables/useSchedule.ts
// Emploi du temps d'un groupe, sur une semaine
// ============================================

import { computed, ref, type ComputedRef, type Ref } from "vue";
import { useCachedResource, type Freshness } from "./useCachedResource";
import type { Course } from "../types/api";

/** Lundi de la semaine contenant une date donnée. */
export function startOfWeek(date: Date): Date {
    const monday = new Date(date);
    const offset = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - offset);
    monday.setHours(0, 0, 0, 0);
    return monday;
}

export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

export function useSchedule(group: Ref<string | null>): {
    courses: ComputedRef<Course[]>;
    freshness: ComputedRef<Freshness>;
    monday: Ref<Date>;
    previousWeek: () => void;
    nextWeek: () => void;
    thisWeek: () => void;
    reload: () => Promise<void>;
} {
    const monday = ref(startOfWeek(new Date()));

    const resource = computed(() => {
        const code = group.value;
        const from = monday.value;

        // Une ressource par couple (groupe, semaine) : le cache d'une semaine
        // consultée reste disponible en y revenant.
        return {
            key: `schedule:${code ?? "none"}:${from.toISOString().slice(0, 10)}`,
            path: () => {
                const end = addDays(from, 7);
                const params = new URLSearchParams({
                    start_at: from.toISOString(),
                    end_at: end.toISOString(),
                    groups: code ?? "",
                });
                return `/api/v2/courses?${params.toString()}`;
            },
        };
    });

    // Une instance par ressource, conservée pour ne pas reperdre le cache déjà lu
    const instances = new Map<string, ReturnType<typeof useCachedResource<Course[]>>>();

    const current = computed(() => {
        const { key, path } = resource.value;
        const existing = instances.get(key);
        if (existing) return existing;

        const created = useCachedResource<Course[]>(key, path);
        instances.set(key, created);
        return created;
    });

    return {
        courses: computed(() => (group.value ? (current.value.data.value ?? []) : [])),
        freshness: computed(() => (group.value ? current.value.freshness.value : "fresh")),
        monday,
        previousWeek: () => {
            monday.value = addDays(monday.value, -7);
        },
        nextWeek: () => {
            monday.value = addDays(monday.value, 7);
        },
        thisWeek: () => {
            monday.value = startOfWeek(new Date());
        },
        reload: () => current.value.reload(),
    };
}
