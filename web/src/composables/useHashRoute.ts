// ============================================
// 📁 src/composables/useHashRoute.ts
// Navigation par fragment d'URL
// ============================================

import { onMounted, onUnmounted, ref, type Ref } from "vue";

/**
 * Suit la vue courante dans le fragment d'URL (`#/salles`).
 *
 * Un fragment suffit ici : deux écrans, un site entièrement client, et une URL
 * qui reste partageable — sans ajouter de routeur.
 */
export function useHashRoute<T extends string>(routes: readonly T[], fallback: T): {
    current: Ref<T>;
    go: (route: T) => void;
} {
    const parse = (): T => {
        const name = window.location.hash.replace(/^#\/?/, "");
        return routes.includes(name as T) ? (name as T) : fallback;
    };

    const current = ref(parse()) as Ref<T>;
    const onChange = () => {
        current.value = parse();
    };

    onMounted(() => window.addEventListener("hashchange", onChange));
    onUnmounted(() => window.removeEventListener("hashchange", onChange));

    return {
        current,
        go: (route: T) => {
            window.location.hash = `#/${route}`;
        },
    };
}
