<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Alert, Button, EmptyState, SectionHeader, Select, SelectOption, Skeleton, Surface } from "@gamo/ds";
import FreshnessBadge from "../components/FreshnessBadge.vue";
import ScheduleGrid from "../components/ScheduleGrid.vue";
import { useCachedResource } from "../composables/useCachedResource";
import { addDays, useSchedule } from "../composables/useSchedule";
import { useStoredGroup } from "../composables/useStoredGroup";
import type { Group } from "../types/api";

const groups = useCachedResource<Group[]>("groups", () => "/api/v1/groups");
const selected = useStoredGroup();

// Sans choix mémorisé, on propose le premier groupe plutôt qu'un écran vide
watch(
    () => groups.data.value,
    (list) => {
        if (!selected.value && list?.length) selected.value = list[0]!.code;
    },
    { immediate: true },
);

const { courses, freshness, monday, previousWeek, nextWeek, thisWeek } = useSchedule(selected);

/** En dessous de cette largeur, six colonnes deviennent illisibles. */
const WIDE_ENOUGH = 700;
const wide = ref(window.innerWidth >= WIDE_ENOUGH);
const onResize = () => {
    wide.value = window.innerWidth >= WIDE_ENOUGH;
};

onMounted(() => window.addEventListener("resize", onResize));
onUnmounted(() => window.removeEventListener("resize", onResize));

/** Jour affiché seul sur écran étroit : aujourd'hui s'il est dans la semaine. */
const dayIndex = ref((new Date().getDay() + 6) % 7);
const singleDay = computed(() => (wide.value ? null : Math.min(dayIndex.value, 5)));

const weekLabel = computed(() => {
    const end = addDays(monday.value, 5);
    const format = (date: Date) =>
        date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return `${format(monday.value)} → ${format(end)}`;
});

const dayLabel = computed(() =>
    addDays(monday.value, singleDay.value ?? 0).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    }),
);

const loading = computed(() => courses.value.length === 0 && freshness.value === "revalidating");

function shiftDay(delta: number): void {
    const next = dayIndex.value + delta;
    if (next < 0) {
        previousWeek();
        dayIndex.value = 5;
    } else if (next > 5) {
        nextWeek();
        dayIndex.value = 0;
    } else {
        dayIndex.value = next;
    }
}
</script>

<template>
    <div class="schedule">
        <header class="schedule__header">
            <SectionHeader title="Emploi du temps" :desc="wide ? weekLabel : dayLabel" />
            <div class="schedule__actions">
                <FreshnessBadge :freshness="freshness" />
                <Select v-if="groups.data.value" v-model="selected" aria-label="Groupe">
                    <SelectOption
                        v-for="group in groups.data.value"
                        :key="group.code"
                        :value="group.code"
                    >
                        {{ group.label }}
                    </SelectOption>
                </Select>
            </div>
        </header>

        <nav class="schedule__nav">
            <template v-if="wide">
                <Button ghost size="sm" @click="previousWeek">← Semaine précédente</Button>
                <Button ghost size="sm" @click="thisWeek">Cette semaine</Button>
                <Button ghost size="sm" @click="nextWeek">Semaine suivante →</Button>
            </template>
            <template v-else>
                <Button ghost size="sm" @click="shiftDay(-1)">← Jour précédent</Button>
                <Button ghost size="sm" @click="shiftDay(1)">Jour suivant →</Button>
            </template>
        </nav>

        <Alert v-if="freshness === 'stale'" variant="warning">
            Emploi du temps affiché depuis le cache : le serveur n'a pas répondu.
        </Alert>

        <Alert v-else-if="freshness === 'error'" variant="error">
            Impossible de joindre le serveur, et aucun emploi du temps en cache.
        </Alert>

        <Skeleton v-if="loading" height="24rem" />

        <EmptyState
            v-else-if="courses.length === 0"
            title="Aucun cours cette semaine"
            description="Rien n'est publié pour ce groupe sur la période affichée."
        />

        <Surface v-else level="card" padding="sm" clip as="section">
            <ScheduleGrid :courses="courses" :monday="monday" :single-day="singleDay" />
        </Surface>
    </div>
</template>

<style scoped>
.schedule {
    display: flex;
    flex-direction: column;
    gap: var(--s6);
}

.schedule__header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--s3);
    flex-wrap: wrap;
}

.schedule__actions {
    display: flex;
    align-items: center;
    gap: var(--s3);
}

.schedule__nav {
    display: flex;
    gap: var(--s2);
    flex-wrap: wrap;
}
</style>
