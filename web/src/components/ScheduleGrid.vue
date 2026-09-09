<script setup lang="ts">
import { computed } from "vue";
import type { Course } from "../types/api";
import { addDays } from "../composables/useSchedule";
import ScheduleLesson from "./ScheduleLesson.vue";

const { courses, monday, singleDay } = defineProps<{
    courses: Course[];
    monday: Date;
    /** Index du jour affiché seul, sur les écrans étroits. `null` = la semaine. */
    singleDay: number | null;
}>();

/** La journée court de 8:00 à 19:30, par tranches de trente minutes. */
const DAY_START_MINUTES = 8 * 60;
const SLOT_MINUTES = 30;
const SLOT_COUNT = 23;

const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;

/** Colonnes affichées : la semaine entière, ou un seul jour. */
const days = computed(() => {
    const all = DAY_NAMES.map((name, index) => ({
        index,
        name,
        date: addDays(monday, index),
    }));

    return singleDay === null ? all : all.filter((day) => day.index === singleDay);
});

/**
 * Libellés de la colonne des heures, une par heure pleine.
 * La ligne 1 est occupée par l'en-tête des jours : les tranches commencent en 2.
 */
const HEADER_ROWS = 1;

const hourLabels = computed(() =>
    Array.from({ length: Math.ceil(SLOT_COUNT / 2) }, (_, index) => ({
        label: `${String(8 + index).padStart(2, "0")}:00`,
        row: index * 2 + 1 + HEADER_ROWS,
    })),
);

interface Placed {
    course: Course;
    day: number;
    row: number;
    span: number;
}

/**
 * Place chaque cours dans la grille : la colonne vient du jour, la ligne et la
 * hauteur des heures de début et de fin.
 */
const placed = computed<Placed[]>(() => {
    const result: Placed[] = [];

    for (const course of courses) {
        const start = new Date(course.start_at);
        const end = new Date(course.end_at);

        const day = (start.getDay() + 6) % 7;
        if (day > 5) continue;

        const startMinutes = start.getHours() * 60 + start.getMinutes() - DAY_START_MINUTES;
        const endMinutes = end.getHours() * 60 + end.getMinutes() - DAY_START_MINUTES;

        const row = Math.round(startMinutes / SLOT_MINUTES) + 1;
        const span = Math.max(1, Math.round((endMinutes - startMinutes) / SLOT_MINUTES));

        // Un événement qui déborde la grille (journée entière, férié) est ramené dedans
        if (row + span - 1 < 1 || row > SLOT_COUNT) continue;

        result.push({
            course,
            day,
            row: Math.max(1, row),
            span: Math.min(span, SLOT_COUNT - Math.max(1, row) + 1),
        });
    }

    return result;
});

/** Colonne de grille d'un jour, en tenant compte du mode une-journée. */
function columnOf(day: number): number {
    const position = days.value.findIndex((entry) => entry.index === day);
    return (position === -1 ? 0 : position) + 2;
}

const visible = computed(() =>
    placed.value.filter((entry) => singleDay === null || entry.day === singleDay),
);

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
</script>

<template>
    <div
        class="grid"
        :style="{
            '--columns': days.length,
            '--slots': SLOT_COUNT,
        }"
    >
        <!-- En-tête : une colonne vide pour les heures, puis les jours -->
        <div class="grid__corner" />
        <div
            v-for="(day, position) in days"
            :key="day.index"
            class="grid__day"
            :style="{ gridColumn: position + 2 }"
        >
            <span class="grid__day-name">{{ day.name }}</span>
            <span class="grid__day-date">{{ dayFormatter.format(day.date) }}</span>
        </div>

        <!-- Colonne des heures -->
        <div
            v-for="hour in hourLabels"
            :key="hour.label"
            class="grid__hour"
            :style="{ gridRow: `${hour.row} / span 2` }"
        >
            {{ hour.label }}
        </div>

        <!-- Trame de fond : une case par tranche, pour matérialiser la grille -->
        <div
            v-for="slot in SLOT_COUNT * days.length"
            :key="`slot-${slot}`"
            class="grid__slot"
            :class="{ 'grid__slot--hour': (slot - 1) % SLOT_COUNT % 2 === 0 }"
            :style="{
                gridRow: ((slot - 1) % SLOT_COUNT) + 1 + HEADER_ROWS,
                gridColumn: Math.floor((slot - 1) / SLOT_COUNT) + 2,
            }"
        />

        <ScheduleLesson
            v-for="entry in visible"
            :key="`${entry.course.code}-${entry.course.start_at}-${entry.day}`"
            :course="entry.course"
            :style="{
                gridRow: `${entry.row + HEADER_ROWS} / span ${entry.span}`,
                gridColumn: columnOf(entry.day),
            }"
        />
    </div>
</template>

<style scoped>
.grid {
    display: grid;
    grid-template-columns: 3.5rem repeat(var(--columns), minmax(0, 1fr));
    grid-template-rows: auto repeat(var(--slots), minmax(1.35rem, auto));
    gap: 1px;
    align-items: stretch;
}

.grid__corner {
    grid-row: 1;
    grid-column: 1;
}

.grid__day {
    grid-row: 1;
    display: flex;
    padding: var(--s2);
    text-align: center;
    flex-direction: column;
    gap: 0.125rem;
    border-bottom: 1px solid var(--border);
}

.grid__day-name {
    font-weight: 600;
}

.grid__day-date {
    color: var(--muted);
    font-size: var(--fs-xs);
}

.grid__hour {
    grid-column: 1;
    padding-right: var(--s2);
    color: var(--muted);
    font-size: var(--fs-xs);
    font-variant-numeric: tabular-nums;
    text-align: right;
}

.grid__slot {
    background: var(--surface);
    border-top: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
}

.grid__slot--hour {
    border-top-color: var(--border);
}

/* Les cours et la trame partagent les mêmes cases : les cours passent devant */
.grid__slot {
    z-index: 0;
}
</style>
