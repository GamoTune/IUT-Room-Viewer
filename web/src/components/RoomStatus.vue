<script setup lang="ts">
import { computed } from "vue";
import { Badge } from "@gamo/ds";
import type { RoomState } from "../composables/useRooms";
import { formatGroups } from "../composables/formatGroups";

const { state } = defineProps<{ state: RoomState }>();

/** Fin du cours en cours, pour dire quand la salle se libère. */
const until = computed(() => {
    if (!state.lesson) return null;
    return new Date(state.lesson.endTime).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
    });
});

const groups = computed(() => (state.lesson ? formatGroups(state.lesson.groups) : ""));

/** `OTHER` couvre ce que l'IUT ne qualifie pas : mieux vaut ne rien afficher. */
const type = computed(() => {
    const value = state.lesson?.type;
    return value && value !== "OTHER" ? value : null;
});

/**
 * Certains cours n'ont pas d'intitulé distinct de leur code : le répéter
 * n'apporterait rien.
 */
const title = computed(() => {
    const lesson = state.lesson;
    if (!lesson) return null;
    return lesson.contentName === lesson.contentCode ? null : lesson.contentName;
});
</script>

<template>
    <div class="room" :class="{ 'room--busy': state.busy }">
        <div class="room__head">
            <span class="room__name">{{ state.room.name }}</span>
            <Badge :variant="state.busy ? 'orange' : 'green'">
                {{ state.busy ? "Occupée" : "Libre" }}
            </Badge>
        </div>

        <p v-if="state.lesson" class="room__detail">
            <span class="room__subject">
                <span class="room__code">{{ state.lesson.contentCode }}</span>
                <span v-if="type" class="room__type">{{ type }}</span>
            </span>
            <span v-if="title">{{ title }}</span>
            <span class="room__meta">
                {{ [state.lesson.teacher, groups].filter(Boolean).join(" · ") }}
                <template v-if="until"> · jusqu'à {{ until }}</template>
            </span>
        </p>

        <p v-else-if="state.busy" class="room__detail room__detail--terse">
            Plusieurs cours sur ce créneau
        </p>
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

.room__detail--terse {
    color: var(--muted);
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
</style>
