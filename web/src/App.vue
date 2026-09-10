<script setup lang="ts">
import { computed } from "vue";
import { PageBackground, SiteHeader } from "@gamo/ds";
import RoomsPage from "./pages/RoomsPage.vue";
import SchedulePage from "./pages/SchedulePage.vue";
import { useHashRoute } from "./composables/useHashRoute";

const ROUTES = ["salles", "edt"] as const;
type Route = (typeof ROUTES)[number];

const { current, go } = useHashRoute<Route>(ROUTES, "salles");

const PAGES = { salles: RoomsPage, edt: SchedulePage } as const;
const page = computed(() => PAGES[current.value]);
</script>

<template>
    <!-- Calque décoratif : il se place derrière le contenu, pas autour. -->
    <PageBackground intensity="subtle" />

    <SiteHeader name="Salles IUT" prefix="iut." name-href="https://gamo.one" accent="lav">
        <template #right>
            <button
                v-for="route in ROUTES"
                :key="route"
                class="nav__link"
                :class="{ 'nav__link--active': current === route }"
                type="button"
                @click="go(route)"
            >
                {{ route === "salles" ? "Salles" : "Emploi du temps" }}
            </button>
        </template>
    </SiteHeader>

    <main class="page">
        <component :is="page" />
    </main>
</template>

<style scoped>
.page {
    width: min(72rem, 100%);
    margin: 0 auto;
    padding: var(--s8) var(--s5) var(--s12);
}

.nav__link {
    padding: var(--s2) var(--s3);
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
}

.nav__link:hover {
    background: var(--surface-hover);
    color: var(--text);
}

.nav__link--active {
    background: color-mix(in srgb, var(--lav) 18%, transparent);
    color: var(--text);
}
</style>
