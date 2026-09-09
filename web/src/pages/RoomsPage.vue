<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Alert, Button, EmptyState, SectionHeader, Skeleton, Surface } from "@gamo/ds";
import FreshnessBadge from "../components/FreshnessBadge.vue";
import RoomStatus from "../components/RoomStatus.vue";
import { useRooms } from "../composables/useRooms";

const { floors, freshness, updatedAt, reload, instant } = useRooms();

/** Heure affichée en tête, rafraîchie à la minute. */
const now = ref(instant.value);
let ticker: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
    ticker = setInterval(() => {
        now.value = instant.value;
    }, 30_000);
});

onUnmounted(() => {
    if (ticker) clearInterval(ticker);
});

const clock = computed(() =>
    now.value.toLocaleString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    }),
);

const freeCount = computed(() =>
    floors.value.reduce((total, floor) => total + floor.rooms.filter((room) => !room.busy).length, 0),
);

const totalCount = computed(() =>
    floors.value.reduce((total, floor) => total + floor.rooms.length, 0),
);

const loading = computed(() => totalCount.value === 0 && freshness.value === "revalidating");
</script>

<template>
    <div class="rooms">
        <header class="rooms__header">
            <SectionHeader title="Salles libres" :desc="clock" />
            <div class="rooms__actions">
                <FreshnessBadge :freshness="freshness" :updated-at="updatedAt" />
                <Button ghost size="sm" @click="reload">Actualiser</Button>
            </div>
        </header>

        <Alert v-if="freshness === 'stale'" variant="warning">
            Les données affichées viennent du cache : le serveur n'a pas répondu.
        </Alert>

        <Alert v-else-if="freshness === 'error'" variant="error">
            Impossible de joindre le serveur, et aucune donnée en cache.
        </Alert>

        <p v-if="totalCount > 0" class="rooms__summary">
            <strong>{{ freeCount }}</strong> salle{{ freeCount > 1 ? "s" : "" }} libre{{ freeCount > 1 ? "s" : "" }}
            sur {{ totalCount }}
        </p>

        <div v-if="loading" class="rooms__loading">
            <Skeleton v-for="index in 4" :key="index" height="8rem" />
        </div>

        <EmptyState
            v-else-if="totalCount === 0"
            title="Aucune salle"
            description="Le référentiel des salles est vide : la base n'a pas encore été alimentée."
        />

        <Surface v-for="floor in floors" v-else :key="floor.label" level="card" padding="md" as="section">
            <h2 class="rooms__floor">{{ floor.label }}</h2>
            <div class="rooms__grid">
                <RoomStatus v-for="state in floor.rooms" :key="state.room.id" :state="state" />
            </div>
        </Surface>
    </div>
</template>

<style scoped>
.rooms {
    display: flex;
    flex-direction: column;
    gap: var(--s4);
}

.rooms__header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--s3);
    flex-wrap: wrap;
}

.rooms__actions {
    display: flex;
    align-items: center;
    gap: var(--s3);
}

.rooms__summary {
    margin: 0;
    color: var(--muted);
}

.rooms__floor {
    margin: 0 0 var(--s3);
    font-size: var(--fs-lg);
    font-weight: 600;
}

.rooms__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: var(--s3);
}

.rooms__loading {
    display: grid;
    gap: var(--s3);
}
</style>
