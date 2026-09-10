// ============================================
// 📁 src/composables/useCachedResource.ts
// Lecture d'une ressource de l'API, avec cache d'affichage
// ============================================

import { ref, shallowRef, type Ref } from "vue";
import type { ApiResponse } from "../types/api";

/**
 * État du contenu affiché, du point de vue du client.
 *
 * - `revalidating` : une requête est en cours ; le cache reste affiché
 * - `fresh`        : les données viennent d'être obtenues du serveur
 * - `stale`        : la requête a échoué, mais le cache permet d'afficher
 * - `error`        : rien à afficher
 */
export type Freshness = "revalidating" | "fresh" | "stale" | "error";

const CACHE_PREFIX = "room-viewer:";

/**
 * Racine de l'API. Vide en développement — Vite relaie `/api` vers le serveur
 * local — et absolue en production : le front est servi par un hébergement
 * mutualisé, qui n'exécute pas le back et ne sait pas le relayer.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface CacheEntry<T> {
    storedAt: number;
    data: T;
}

function readCache<T>(key: string): CacheEntry<T> | null {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
    } catch {
        // Navigation privée, quota atteint, données corrompues : on repart du réseau
        return null;
    }
}

function writeCache<T>(key: string, data: T): void {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ storedAt: Date.now(), data }));
    } catch {
        // Le cache n'est qu'un confort d'affichage : son échec n'a pas à remonter
    }
}

export interface CachedResource<T> {
    data: Ref<T | null>;
    freshness: Ref<Freshness>;
    /** Horodatage des données affichées, cache compris. */
    updatedAt: Ref<number | null>;
    reload: () => Promise<void>;
}

/**
 * Affiche d'abord ce qui est en cache, puis interroge systématiquement l'API.
 *
 * Un emploi du temps peut être modifié à tout moment sans qu'on puisse le
 * savoir d'avance : le cache sert à afficher quelque chose immédiatement, jamais
 * à éviter la requête.
 */
export function useCachedResource<T>(key: string, path: () => string): CachedResource<T> {
    const data = shallowRef<T | null>(null);
    const freshness = ref<Freshness>("revalidating");
    const updatedAt = ref<number | null>(null);

    const cached = readCache<T>(key);
    if (cached) {
        data.value = cached.data;
        updatedAt.value = cached.storedAt;
    }

    async function reload(): Promise<void> {
        freshness.value = "revalidating";

        try {
            const response = await fetch(API_BASE + path(), { headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const payload = (await response.json()) as ApiResponse<T>;
            if (!payload.success) throw new Error(payload.error ?? "Réponse en échec");

            data.value = payload.data;
            updatedAt.value = Date.now();
            freshness.value = "fresh";
            writeCache(key, payload.data);
        } catch (error) {
            console.error(`Récupération de ${key} impossible :`, error);
            freshness.value = data.value === null ? "error" : "stale";
        }
    }

    void reload();

    return { data, freshness, updatedAt, reload };
}
