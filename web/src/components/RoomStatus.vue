<script setup lang="ts">
import { computed } from "vue";
import { Badge } from "@gamo/ds";
import type { Lesson } from "../types/api";
import type { RoomState } from "../composables/useRooms";
import { formatGroups } from "../composables/formatGroups";

const { state, live } = defineProps<{
    state: RoomState;
    /** Consultation de l'instant présent : l'heure de fin suffit à situer le cours. */
    live: boolean;
}>();

/** Au-delà, la carte devient une liste illisible. */
const MAX_SHOWN = 3;

const shown = computed(() => state.lessons.slice(0, MAX_SHOWN));
const hidden = computed(() => Math.max(0, state.lessons.length - MAX_SHOWN));

const time = (value: string): string =>
    new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** `OTHER` couvre ce que l'IUT ne qualifie pas : mieux vaut ne rien afficher. */
const typeOf = (lesson: Lesson): string | null =>
    lesson.type && lesson.type !== "OTHER" ? lesson.type : null;

/**
 * Certains cours n'ont pas d'intitulé distinct de leur code : le répéter
 * n'apporterait rien.
 */
const titleOf = (lesson: Lesson): string | null =>
    lesson.contentName === lesson.contentCode ? null : lesson.contentName;

const metaOf = (lesson: Lesson): string => {
    const when = live ? `jusqu'à ${time(lesson.endTime)}` : `${time(lesson.startTime)} – ${time(lesson.endTime)}`;
    return [lesson.teacher, formatGroups(lesson.groups), when].filter(Boolean).join(" · ");
};
</script>

<template>
    <div class="room" :class="{ 'room--busy': state.busy }">
        <div class="room__head">
            <span class="room__name">{{ state.room.name }}</span>
            <Badge :variant="state.busy ? 'orange' : 'green'">
                {{ state.busy ? "Occupée" : "Libre" }}
            </Badge>
        </div>

        <p v-for="lesson in shown" :key="lesson.id" class="room__detail">
            <span class="room__subject">
                <span class="room__code">{{ lesson.contentCode }}</span>
                <span v-if="typeOf(lesson)" class="room__type">{{ typeOf(lesson) }}</span>
            </span>
            <span v-if="titleOf(lesson)">{{ titleOf(lesson) }}</span>
            <span class="room__meta">{{ metaOf(lesson) }}</span>
        </p>

        <p v-if="hidden > 0" class="room__more">et {{ hidden }} autre{{ hidden > 1 ? "s" : "" }} cours</p>
    </div>
</template>

<style scoped>
.room {
    display: flex;
    flex-direction: column;
    gap: var(--s2);
    padding: var(--s4);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--surface);
}

.room--busy {
    border-color: color-mix(in srgb, var(--orange) 40%, var(--border));
}

.room__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s2);
}

.room__name {
    font-family: var(--font-mono);
    font-size: var(--fs-lg);
    font-weight: 600;
}

.room__detail {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin: 0;
    font-size: var(--fs-sm);
}

/* Les cours successifs d'un même créneau se distinguent par un filet. */
.room__detail + .room__detail {
    padding-top: var(--s2);
    border-top: 1px solid var(--border-subtle);
}

.room__subject {
    display: flex;
    align-items: baseline;
    gap: var(--s2);
}

.room__code {
    font-family: var(--font-mono);
    font-weight: 600;
}

.room__type {
    padding: 0 var(--s1);
    border-radius: var(--radius-sm);
    background: var(--surface-hover);
    color: var(--muted);
    font-size: var(--fs-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
}

.room__meta {
    color: var(--muted);
}

.room__more {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-sm);
}
</style>
