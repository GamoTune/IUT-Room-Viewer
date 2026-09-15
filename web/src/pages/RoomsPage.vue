<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Alert, Button, EmptyState, SectionHeader, Skeleton, Slider, Surface } from "@gamo/ds";
import FreshnessBadge from "../components/FreshnessBadge.vue";
import GroupSelect from "../components/GroupSelect.vue";
import RoomStatus from "../components/RoomStatus.vue";
import { findGroup } from "../composables/groupMatch";
import { useGroups } from "../composables/useGroups";
import { useRooms } from "../composables/useRooms";
import { useStoredGroup } from "../composables/useStoredGroup";
import {
    DAY_START_MINUTES,
    MAX_DURATION_MINUTES,
    MIN_DURATION_MINUTES,
    SLOT_MINUTES,
    formatDuration,
    formatTime,
    useRoomWindow,
} from "../composables/useRoomWindow";

const picker = useRoomWindow();

const selected = useStoredGroup();
const groups = useGroups();
const group = computed(() => findGroup(groups.data.value, selected.value));

const { floors, freshness, updatedAt, reload } = useRooms(picker.window, group);

/** Heure affichée en tête, rafraîchie à la minute. */
const now = ref(new Date());
let ticker: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
    ticker = setInterval(() => {
        now.value = new Date();
    }, 30_000);
});

onUnmounted(() => {
    if (ticker) clearInterval(ticker);
});

const dayLabel = computed(() =>
    picker.day.value.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
);

/** Sous-titre : l'heure qui tourne en direct, le créneau choisi sinon. */
const subtitle = computed(() => {
    if (picker.window.value.live) {
        return `${now.value.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${now.value.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return `${dayLabel.value}, ${formatTime(picker.start.value)} → ${picker.endLabel.value}`;
});

const freeCount = computed(() =>
    floors.value.reduce((total, floor) => total + floor.rooms.filter((room) => !room.busy).length, 0),
);

const totalCount = computed(() =>
    floors.value.reduce((total, floor) => total + floor.rooms.length, 0),
);

const mineCount = computed(() =>
    floors.value.reduce((total, floor) => total + floor.rooms.filter((room) => room.mine).length, 0),
);

const loading = computed(() => totalCount.value === 0 && freshness.value === "revalidating");
</script>

<template>
    <div class="rooms">
        <header class="rooms__header">
            <SectionHeader title="Salles libres" :desc="subtitle" />
            <div class="rooms__actions">
                <FreshnessBadge :freshness="freshness" :updated-at="updatedAt" />
                <Button ghost size="sm" @click="reload">Actualiser</Button>
                <GroupSelect v-model="selected" />
            </div>
        </header>

        <Surface level="card" padding="lg" as="section" class="picker">
            <div class="picker__day">
                <Button ghost size="sm" @click="picker.shiftDay(-1)">← Jour précédent</Button>
                <div class="picker__center">
                    <span class="picker__date">{{ dayLabel }}</span>
                    <Button v-if="!picker.window.value.live" ghost size="sm" @click="picker.now()">
                        Maintenant
                    </Button>
                </div>
                <Button ghost size="sm" @click="picker.shiftDay(1)">Jour suivant →</Button>
            </div>

            <Slider
                :model-value="picker.start.value"
                :min="DAY_START_MINUTES"
                :max="picker.maxStart.value"
                :step="SLOT_MINUTES"
                :format="formatTime"
                @update:model-value="picker.setStart"
            >
                Début
            </Slider>

            <Slider
                :model-value="picker.duration.value"
                :min="MIN_DURATION_MINUTES"
                :max="MAX_DURATION_MINUTES"
                :step="SLOT_MINUTES"
                :format="formatDuration"
                @update:model-value="picker.setDuration"
            >
                Durée
                <template #hint>jusqu'à {{ picker.endLabel.value }}</template>
            </Slider>
        </Surface>

        <Alert v-if="freshness === 'stale'" variant="warning">
            Les données affichées viennent du cache : le serveur n'a pas répondu.
        </Alert>

        <Alert v-else-if="freshness === 'error'" variant="error">
            Impossible de joindre le serveur, et aucune donnée en cache.
        </Alert>

        <p v-if="totalCount > 0" class="rooms__summary">
            <strong>{{ freeCount }}</strong> salle{{ freeCount > 1 ? "s" : "" }} libre{{ freeCount > 1 ? "s" : "" }}
            sur {{ totalCount }}
            <template v-if="!picker.window.value.live">sur tout le créneau</template>
            <template v-if="mineCount > 0">
                · <strong class="rooms__mine">{{ mineCount }}</strong> pour {{ group?.label }}
            </template>
        </p>

        <div v-if="loading" class="rooms__loading">
            <Skeleton v-for="index in 4" :key="index" height="8rem" />
        </div>

        <EmptyState
            v-else-if="totalCount === 0"
            title="Aucune salle"
            description="Le référentiel des salles est vide : la base n'a pas encore été alimentée."
        />

        <Surface v-for="floor in floors" v-else :key="floor.label" level="card" padding="lg" as="section">
            <h2 class="rooms__floor">{{ floor.label }}</h2>
            <div class="rooms__grid">
                <RoomStatus
                    v-for="state in floor.rooms"
                    :key="state.room.id"
                    :state="state"
                    :live="picker.window.value.live"
                />
            </div>
        </Surface>
    </div>
</template>

<style scoped>
.rooms {
    display: flex;
    flex-direction: column;
    gap: var(--s6);
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

.picker {
    display: flex;
    flex-direction: column;
    gap: var(--s4);
}

/* Sur un écran large, le créneau reste sous les yeux pendant qu'on parcourt les
   étages : il se colle en haut et passe devant les cartes. Sur un téléphone il
   défile normalement — collé, il mangerait un quart de l'écran en permanence. */
@media (min-width: 60rem) {
    .picker {
        position: sticky;
        top: var(--s3);
        z-index: 2;
    }
}

.picker__day {
    display: flex;
    align-items: center;
    gap: var(--s2);
    flex-wrap: wrap;
}

.picker__center {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: var(--s3);
    flex-wrap: wrap;
}

.picker__date {
    font-weight: 600;
}

.rooms__summary {
    margin: 0;
    color: var(--muted);
}

.rooms__mine {
    color: var(--lav);
}

.rooms__floor {
    margin: 0 0 var(--s4);
    font-size: var(--fs-lg);
    font-weight: 600;
}

.rooms__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: var(--s4);
}

.rooms__loading {
    display: grid;
    gap: var(--s4);
}
</style>
