// ============================================
// 📁 src/composables/useGroups.ts
// Liste des groupes, partagée par les deux écrans
// ============================================

import { useCachedResource, type CachedResource } from "./useCachedResource";
import type { Group } from "../types/api";

/**
 * Une seule instance pour toute l'application : les deux écrans affichent le
 * même sélecteur, la liste n'a pas à être demandée deux fois.
 */
let shared: CachedResource<Group[]> | null = null;

export function useGroups(): CachedResource<Group[]> {
    shared ??= useCachedResource<Group[]>("groups", () => "/api/v1/groups");
    return shared;
}
