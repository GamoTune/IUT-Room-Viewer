<script setup lang="ts">
import { computed } from "vue";
import type { Course } from "../types/api";

const { course, span } = defineProps<{
    course: Course;
    /** Nombre de tranches occupées : il fixe la place disponible. */
    span: number;
}>();

// La hauteur d'une case est désormais fixe : on choisit ce qui rentre plutôt
// que de laisser le contenu repousser la grille.
const showMeta = computed(() => span >= 2);
const showTitle = computed(() => span >= 3);
const showHours = computed(() => span >= 4);

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
    <article
        class="lesson"
        :class="[`lesson--${accent}`, { 'lesson--tight': span < 2 }]"
        :title="`${course.code} · ${course.title} · ${hours}${rooms ? ` · ${rooms}` : ''}`"
    >
        <span class="lesson__code">{{ course.code }}</span>
        <span v-if="showTitle" class="lesson__title">{{ course.title }}</span>
        <span v-if="showMeta" class="lesson__meta">
            <span v-if="rooms" class="lesson__room">{{ rooms }}</span>
            <span v-if="course.teacher && course.teacher !== 'Inconnu'">{{ course.teacher }}</span>
        </span>
        <span v-if="showHours" class="lesson__hours">{{ hours }}</span>
    </article>
</template>

<style scoped>
.lesson {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    /* `min-height: 0` lève le minimum implicite des éléments de grille : sans
       lui, un contenu trop long repousserait la ligne au lieu d'être rogné. */
    min-height: 0;
    overflow: hidden;
    justify-self: start;
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
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    color: var(--text);
}

/* Une demi-heure ne laisse la place qu'au code : on lui rend ses marges. */
.lesson--tight {
    padding: 0 var(--s1) 0 var(--s2);
    justify-content: center;
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
