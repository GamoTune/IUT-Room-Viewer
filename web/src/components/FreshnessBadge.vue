<script setup lang="ts">
import { computed } from "vue";
import { Badge } from "@gamo/ds";
import type { Freshness } from "../composables/useCachedResource";

const { freshness, updatedAt } = defineProps<{
    freshness: Freshness;
    updatedAt?: number | null;
}>();

/**
 * Ce que le badge annonce, du point de vue de la personne qui consulte.
 * Les couleurs reprennent la sémantique du design system : vert pour ce qui
 * va bien, jaune pour une réserve, orange pour un échec.
 */
const appearance = computed(() => {
    switch (freshness) {
        case "revalidating":
            return { label: "Mise à jour…", variant: "cyan" as const };
        case "fresh":
            return { label: "À jour", variant: "green" as const };
        case "stale":
            return { label: "Données en cache", variant: "yellow" as const };
        default:
            return { label: "Indisponible", variant: "orange" as const };
    }
});

/** Heure des données affichées, utile quand elles viennent du cache. */
const time = computed(() => {
    if (!updatedAt) return null;
    return new Date(updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
});
</script>

<template>
    <span class="freshness">
        <Badge :variant="appearance.variant" dot>{{ appearance.label }}</Badge>
        <span v-if="time && freshness !== 'fresh'" class="freshness__time">{{ time }}</span>
    </span>
</template>

<style scoped>
.freshness {
    display: inline-flex;
    align-items: center;
    gap: var(--s2);
}

.freshness__time {
    color: var(--muted);
    font-size: var(--fs-sm);
    font-variant-numeric: tabular-nums;
}
</style>
