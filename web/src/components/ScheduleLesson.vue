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

/**
 * Code couleur repris de l'emploi du temps publié par l'IUT, transposé sur les
 * accents du design system.
 *
 * Le design system n'a pas de rouge ; son orange en tient lieu, c'est aussi la
 * couleur qu'il donne au rôle `danger`.
 */
const accent = computed(() => {
    switch (course.type) {
        case "SAE":
            return "green";
        case "CM":
            return "yellow";
        case "TD":
            return "orange";
        case "TP":
            return "cyan";
        default:
            return "lav";
    }
});

const rooms = computed(() => course.rooms.join(", "));

/** `OTHER` couvre ce que l'IUT ne qualifie pas : mieux vaut ne rien afficher. */
const type = computed(() => (course.type && course.type !== "OTHER" ? course.type : null));
</script>

<template>
    <article
        class="lesson"
        :class="[`lesson--${accent}`, { 'lesson--tight': span < 2 }]"
        :title="`${course.code} · ${course.title} · ${hours}${rooms ? ` · ${rooms}` : ''}`"
    >
        <span class="lesson__head">
            <span class="lesson__code">{{ course.code }}</span>
            <span v-if="type" class="lesson__type">{{ type }}</span>
        </span>
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

.lesson--orange {
    --accent: var(--orange);
}

.lesson--yellow {
    --accent: var(--yellow);
}

.lesson__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--s2);
}

.lesson__code {
    font-family: var(--font-mono);
    font-weight: 600;
}

/* Le type reprend l'accent de la case : la couleur et le texte disent la même
   chose, l'un pour le coup d'œil, l'autre pour la certitude. */
.lesson__type {
    flex-shrink: 0;
    color: var(--accent);
    font-size: var(--fs-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
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
