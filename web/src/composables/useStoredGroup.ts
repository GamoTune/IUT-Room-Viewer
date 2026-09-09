// ============================================
// 📁 src/composables/useStoredGroup.ts
// Mémorisation du groupe consulté
// ============================================

import { ref, watch, type Ref } from "vue";

const STORAGE_KEY = "room-viewer:group";

/**
 * Retient le groupe choisi d'une visite à l'autre : en réouvrant le site, on
 * retombe sur son propre emploi du temps sans rien resélectionner.
 */
export function useStoredGroup(): Ref<string | null> {
    const initial = (() => {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    })();

    const group = ref<string | null>(initial);

    watch(group, (value) => {
        try {
            if (value) localStorage.setItem(STORAGE_KEY, value);
            else localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Sans stockage, le choix ne survit pas à la session : sans gravité
        }
    });

    return group;
}
