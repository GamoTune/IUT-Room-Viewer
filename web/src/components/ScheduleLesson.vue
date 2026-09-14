<script setup lang="ts">
import { computed } from "vue";
import type { Course } from "../types/api";

const { course, span } = defineProps<{
    course: Course;
    /** Nombre de tranches occupées : il fixe la place disponible. */
    span: number;
}>();

// La hauteur d'une case est fixe : on choisit ce qui rentre plutôt que de
// laisser le contenu repousser la grille. Une demi-heure tient sur une ligne,
// chaque tranche en plus débloque une information.
const compact = computed(() => span < 2);
const showCode = computed(() => span >= 4 && hasOwnTitle.value);
const titleLines = computed(() => Math.min(Math.max(span - 1, 1), 3));

/** L'IUT reprend parfois le code en guise d'intitulé : on ne le répète pas. */
const hasOwnTitle = computed(() => course.title.trim() !== "" && course.title.trim() !== course.code);
const title = computed(() => (hasOwnTitle.value ? course.title : course.code));

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
const teacher = computed(() => (course.teacher && course.teacher !== "Inconnu" ? course.teacher : null));

/** `OTHER` couvre ce que l'IUT ne qualifie pas : mieux vaut ne rien afficher. */
const type = computed(() => (course.type && course.type !== "OTHER" ? course.type : null));
</script>

<template>
    <article
        class="lesson"
        :class="[`lesson--${accent}`, { 'lesson--compact': compact }]"
        :style="{ '--title-lines': titleLines }"
        :title="`${course.code} · ${course.title} · ${hours}${rooms ? ` · ${rooms}` : ''}`"
    >
        <span v-if="!compact" class="lesson__head">
            <span v-if="type" class="lesson__type">{{ type }}</span>
            <span class="lesson__hours">{{ hours }}</span>
        </span>

        <span v-else-if="type" class="lesson__type">{{ type }}</span>
        <strong class="lesson__title">{{ title }}</strong>
        <span v-if="showCode" class="lesson__code">{{ course.code }}</span>

        <span v-if="rooms || (teacher && !compact)" class="lesson__place">
            <span v-if="rooms" class="lesson__room">{{ rooms }}</span>
            <span v-if="teacher && !compact" class="lesson__teacher">{{ teacher }}</span>
        </span>
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
    padding: var(--s1) var(--s2);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--accent) 14%, var(--card));
    font-size: var(--fs-xs);
    line-height: var(--lh-snug);
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

/* Le type et l'horaire encadrent la case, en petit : la grille dit déjà quand,
   la couleur dit déjà quoi, ils ne font que le confirmer. */
.lesson__head {
    display: flex;
    align-items: baseline;
    gap: var(--s2);
    min-width: 0;
}

.lesson__type {
    flex-shrink: 0;
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.04em;
}

.lesson__hours {
    overflow: hidden;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* La matière est ce qu'on cherche du regard : c'est elle qui porte le poids. */
.lesson__title {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--title-lines);
    color: var(--text);
    font-size: var(--fs-sm);
    font-weight: 600;
    overflow-wrap: anywhere;
}

.lesson__code {
    color: var(--muted);
}

/* La salle et le prof suivent directement la matière : la case se lit d'un
   bloc, sans vide au milieu. */
.lesson__place {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 var(--s2);
}

.lesson__room {
    color: var(--text);
    font-weight: 600;
}

.lesson__teacher {
    color: var(--muted);
}

/* Une demi-heure : tout sur une ligne, la salle poussée à droite. */
.lesson--compact {
    flex-direction: row;
    align-items: center;
    gap: var(--s2);
    padding-block: 0;
    white-space: nowrap;
}

.lesson--compact .lesson__title {
    display: block;
    flex: 1;
    min-width: 0;
    text-overflow: ellipsis;
    font-size: var(--fs-xs);
}

.lesson--compact .lesson__place {
    flex-wrap: nowrap;
}
</style>
