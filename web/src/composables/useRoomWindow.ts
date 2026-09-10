// ============================================
// 📁 src/composables/useRoomWindow.ts
// Créneau consulté dans la vue des salles : un jour, une heure, une durée
// ============================================

import { computed, ref, type ComputedRef, type Ref } from "vue";

/** Plage consultable : 8:00 → 20:00, par tranches de trente minutes. */
export const DAY_START_MINUTES = 8 * 60;
export const DAY_END_MINUTES = 20 * 60;
export const SLOT_MINUTES = 30;

/** Durées proposées : d'une demi-heure à huit heures. */
export const MIN_DURATION_MINUTES = SLOT_MINUTES;
export const MAX_DURATION_MINUTES = 8 * 60;

export interface RoomWindow {
    from: Date;
    to: Date;
    /** `true` tant qu'on regarde l'instant présent plutôt qu'un créneau choisi. */
    live: boolean;
    /** Identifiant stable du créneau, pour la clé de cache. */
    key: string;
}

/** Minutes depuis minuit → `13:30`. */
export function formatTime(minutes: number): string {
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    return `${hours}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Minutes → `30 min`, `1h`, `1h30`. */
export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

/** Demi-heure entamée : à 11:24, on propose 11:00. */
function currentSlot(): number {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const floored = Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES;
    return Math.min(Math.max(floored, DAY_START_MINUTES), DAY_END_MINUTES - MIN_DURATION_MINUTES);
}

function startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function atMinutes(day: Date, minutes: number): Date {
    const result = startOfDay(day);
    result.setMinutes(minutes);
    return result;
}

export function useRoomWindow(): {
    day: Ref<Date>;
    start: Ref<number>;
    duration: Ref<number>;
    /** Bornes du curseur d'heure, resserrées par la durée choisie. */
    maxStart: ComputedRef<number>;
    endLabel: ComputedRef<string>;
    window: ComputedRef<RoomWindow>;
    setStart: (minutes: number) => void;
    setDuration: (minutes: number) => void;
    shiftDay: (delta: number) => void;
    /** Revenir à l'instant présent, aujourd'hui. */
    now: () => void;
} {
    const day = ref(startOfDay(new Date()));
    const start = ref(currentSlot());
    const duration = ref(2 * 60);

    // On interroge l'instant présent tant que l'utilisateur n'a rien choisi.
    const live = ref(true);

    const maxStart = computed(() => DAY_END_MINUTES - duration.value);
    const endLabel = computed(() => formatTime(Math.min(start.value + duration.value, DAY_END_MINUTES)));

    const window = computed<RoomWindow>(() => {
        if (live.value) {
            const instant = new Date();
            // `from === to` : le back interroge alors un instant, pas une plage.
            return { from: instant, to: instant, live: true, key: "now" };
        }

        const from = atMinutes(day.value, start.value);
        const to = atMinutes(day.value, Math.min(start.value + duration.value, DAY_END_MINUTES));
        const key = `${from.toISOString().slice(0, 10)}:${start.value}+${duration.value}`;
        return { from, to, live: false, key };
    });

    const clampStart = (minutes: number): number =>
        Math.min(Math.max(minutes, DAY_START_MINUTES), DAY_END_MINUTES - duration.value);

    const setStart = (minutes: number): void => {
        live.value = false;
        start.value = clampStart(minutes);
    };

    /** Allonger le créneau près de la fin de journée recule son début plutôt que de le tronquer. */
    const setDuration = (minutes: number): void => {
        live.value = false;
        duration.value = Math.min(Math.max(minutes, MIN_DURATION_MINUTES), MAX_DURATION_MINUTES);
        start.value = clampStart(start.value);
    };

    const shiftDay = (delta: number): void => {
        live.value = false;
        const next = new Date(day.value);
        next.setDate(next.getDate() + delta);
        day.value = next;
    };

    const now = (): void => {
        live.value = true;
        day.value = startOfDay(new Date());
        start.value = currentSlot();
        duration.value = 2 * 60;
    };

    return { day, start, duration, maxStart, endLabel, window, setStart, setDuration, shiftDay, now };
}
