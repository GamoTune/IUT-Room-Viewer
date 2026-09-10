<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
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
        // La dernière heure n'est qu'à moitié dans la grille : sans cette borne
        // elle créerait une ligne implicite au-delà des tranches déclarées.
        span: Math.min(2, SLOT_COUNT - index * 2),
    })),
);

interface Slot {
    course: Course;
    day: number;
    row: number;
    span: number;
}

interface Placed extends Slot {
    /** Position horizontale parmi les cours simultanés, et leur nombre. */
    lane: number;
    lanes: number;
}

/**
 * Place chaque cours dans la grille : la colonne vient du jour, la ligne et la
 * hauteur des heures de début et de fin.
 */
const placed = computed<Placed[]>(() => {
    const byDay = new Map<number, Slot[]>();

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

        const clamped = Math.max(1, row);
        const slots = byDay.get(day) ?? [];
        slots.push({ course, day, row: clamped, span: Math.min(span, SLOT_COUNT - clamped + 1) });
        byDay.set(day, slots);
    }

    return [...byDay.values()].flatMap(assignLanes);
});

/**
 * Répartit les cours d'une journée en couloirs côte à côte. Sans cela, deux
 * cours simultanés — le cas des groupes dédoublés — se recouvriraient
 * intégralement, la grille ayant des lignes de hauteur fixe.
 *
 * Les couloirs sont comptés par grappe de cours qui se chevauchent de proche en
 * proche : une collision le matin ne doit pas rétrécir l'après-midi.
 */
function assignLanes(slots: Slot[]): Placed[] {
    const sorted = [...slots].sort((a, b) => a.row - b.row || b.span - a.span);
    const result: Placed[] = [];

    let cluster: Placed[] = [];
    let clusterEnd = 0;
    /** Ligne à laquelle chaque couloir se libère. */
    let laneEnds: number[] = [];

    const flush = (): void => {
        for (const entry of cluster) entry.lanes = laneEnds.length;
        result.push(...cluster);
        cluster = [];
        laneEnds = [];
        clusterEnd = 0;
    };

    for (const slot of sorted) {
        if (cluster.length > 0 && slot.row >= clusterEnd) flush();

        let lane = laneEnds.findIndex((end) => end <= slot.row);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = slot.row + slot.span;

        cluster.push({ ...slot, lane, lanes: 1 });
        clusterEnd = Math.max(clusterEnd, slot.row + slot.span);
    }

    if (cluster.length > 0) flush();
    return result;
}

/** Colonne de grille d'un jour, en tenant compte du mode une-journée. */
function columnOf(day: number): number {
    const position = days.value.findIndex((entry) => entry.index === day);
    return (position === -1 ? 0 : position) + 2;
}

const visible = computed(() =>
    placed.value.filter((entry) => singleDay === null || entry.day === singleDay),
);

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** Heure courante, pour le trait qui traverse la grille. Rafraîchie à la minute. */
const now = ref(new Date());
let ticker: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
    ticker = setInterval(() => {
        now.value = new Date();
    }, 60_000);
});

onUnmounted(() => {
    if (ticker) clearInterval(ticker);
});

/**
 * Position d'aujourd'hui parmi les colonnes affichées, `null` s'il n'y figure
 * pas — semaine passée ou à venir, week-end, ou jour unique portant sur un
 * autre jour. C'est ce qui empêche de marquer « aujourd'hui » la semaine
 * suivante.
 */
const todayPosition = computed<number | null>(() => {
    const index = (now.value.getDay() + 6) % 7;
    if (index > 5) return null;

    // La colonne porte la date de la semaine affichée : si elle ne tombe pas sur
    // aujourd'hui, c'est qu'on regarde une autre semaine.
    const entry = days.value.find((day) => day.index === index);
    if (!entry || entry.date.toDateString() !== now.value.toDateString()) return null;

    return days.value.indexOf(entry);
});

/** Ligne et décalage du trait d'heure, `null` hors de la plage affichée. */
const nowMarker = computed(() => {
    if (todayPosition.value === null) return null;

    const minutes = now.value.getHours() * 60 + now.value.getMinutes() - DAY_START_MINUTES;
    if (minutes < 0 || minutes >= SLOT_COUNT * SLOT_MINUTES) return null;

    return {
        row: Math.floor(minutes / SLOT_MINUTES) + 1 + HEADER_ROWS,
        /** Part de la tranche déjà écoulée, de 0 à 1. */
        offset: (minutes % SLOT_MINUTES) / SLOT_MINUTES,
    };
});
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
            :class="{ 'grid__day--today': position === todayPosition }"
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
            :style="{ gridRow: `${hour.row} / span ${hour.span}` }"
        >
            {{ hour.label }}
        </div>

        <!-- Trame de fond : une case par tranche, pour matérialiser la grille -->
        <div
            v-for="slot in SLOT_COUNT * days.length"
            :key="`slot-${slot}`"
            class="grid__slot"
            :class="{
                'grid__slot--hour': (slot - 1) % SLOT_COUNT % 2 === 0,
                'grid__slot--today': Math.floor((slot - 1) / SLOT_COUNT) === todayPosition,
            }"
            :style="{
                gridRow: ((slot - 1) % SLOT_COUNT) + 1 + HEADER_ROWS,
                gridColumn: Math.floor((slot - 1) / SLOT_COUNT) + 2,
            }"
        />

        <div
            v-if="nowMarker"
            class="grid__now"
            :style="{ gridRow: nowMarker.row, '--offset': nowMarker.offset }"
            aria-hidden="true"
        />

        <ScheduleLesson
            v-for="entry in visible"
            :key="`${entry.course.code}-${entry.course.start_at}-${entry.day}`"
            :course="entry.course"
            :span="entry.span"
            :style="{
                gridRow: `${entry.row + HEADER_ROWS} / span ${entry.span}`,
                gridColumn: columnOf(entry.day),
                width: `calc(${100 / entry.lanes}% - ${entry.lanes > 1 ? '2px' : '0px'})`,
                marginLeft: `${(100 * entry.lane) / entry.lanes}%`,
            }"
        />
    </div>
</template>

<style scoped>
.grid {
    /* Hauteur d'une tranche de trente minutes. Fixe : une heure doit occuper la
       même hauteur partout, sinon la grille ment sur les durées. */
    --slot-height: 1.75rem;

    display: grid;
    grid-template-columns: 3.5rem repeat(var(--columns), minmax(0, 1fr));
    grid-template-rows: auto repeat(var(--slots), var(--slot-height));
    gap: 1px;
    align-items: stretch;
}

/* Une seule colonne : la place gagnée en largeur passe en hauteur. */
@media (max-width: 700px) {
    .grid {
        --slot-height: 2.25rem;
    }
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

/* Aujourd'hui, et seulement dans la semaine où il tombe. */
.grid__day--today {
    border-bottom-color: var(--pink);
}

.grid__day--today .grid__day-name {
    color: var(--pink);
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

.grid__slot--today {
    background: color-mix(in srgb, var(--pink) 5%, var(--surface));
}

/* Trait de l'heure courante : il traverse la grille, colonne des heures
   comprise, et passe devant les cours. Le rose n'est porté par aucun type de
   séance : il ne peut pas se confondre avec une case. */
.grid__now {
    position: relative;
    z-index: 3;
    grid-column: 1 / -1;
    align-self: start;
    height: 0;
    border-top: 2px solid var(--pink);
    /* Le trait est ancré au début de sa tranche ; le décalage l'y fait glisser. */
    transform: translateY(calc(var(--offset) * var(--slot-height)));
    pointer-events: none;
}

.grid__now::before {
    content: "";
    position: absolute;
    top: -4px;
    left: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--pink);
}

/* Les cours et la trame partagent les mêmes cases : les cours passent devant */
.grid__slot {
    z-index: 0;
}
</style>
