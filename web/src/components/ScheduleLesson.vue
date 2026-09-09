<script setup lang="ts">
import { computed } from "vue";
import type { Course } from "../types/api";

const { course } = defineProps<{ course: Course }>();

const hours = computed(() => {
    const format = (value: string) =>
        new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return `${format(course.start_at)} – ${format(course.end_at)}`;
});

/** Une couleur par type de cours, pour distinguer d'un coup d'œil. */
const accent = computed(() => {
    switch (course.type) {
        case "CM":
            return "lav";
        case "TD":
            return "cyan";
        case "TP":
            return "green";
        default:
            return "yellow";
    }
});

const rooms = computed(() => course.rooms.join(", "));
</script>

<template>
    <article class="lesson" :class="`lesson--${accent}`">
        <span class="lesson__code">{{ course.code }}</span>
        <span class="lesson__title">{{ course.title }}</span>
        <span class="lesson__meta">
            <span v-if="rooms" class="lesson__room">{{ rooms }}</span>
            <span v-if="course.teacher && course.teacher !== 'Inconnu'">{{ course.teacher }}</span>
        </span>
        <span class="lesson__hours">{{ hours }}</span>
    </article>
</template>

<style scoped>
.lesson {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    overflow: hidden;
    padding: var(--s2);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--accent) 14%, var(--card));
    font-size: var(--fs-xs);
    line-height: var(--lh-tight, 1.25);
}

.lesson--lav {
    --accent: var(--lav);
}

.lesson--cyan {
    --accent: var(--cyan);
}

.lesson--green {
    --accent: var(--green);
}

.lesson--yellow {
    --accent: var(--yellow);
}

.lesson__code {
    font-family: var(--font-mono);
    font-weight: 600;
}

.lesson__title {
    color: var(--text);
}

.lesson__meta,
.lesson__hours {
    color: var(--muted);
}

.lesson__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--s2);
}

.lesson__room {
    font-family: var(--font-mono);
}
</style>
