// ============================================
// 📁 src/sync/rooms.ts
// Interprétation des salles citées dans un emploi du temps
// ============================================

import { isKnownRoom } from "./rooms.reference.js";

/** Valeur utilisée par l'IUT pour « pas de salle » (jours fériés notamment). */
export const NO_ROOM = ".";

export interface LocationParts {
    roomNames: string[];
    unknownRooms: string[];
}

/**
 * Interprète un LOCATION.
 *
 * Formats rencontrés :
 *   `R52`, `103`   → une salle
 *   `AC`, `AB`     → amphithéâtres C et B
 *   `108-9`        → salles 108 **et** 109
 *   `111-2`        → salles 111 et 112
 *   `.` ou vide    → aucune salle
 */
export function parseLocation(location: string): LocationParts {
    const cleaned = location.trim();
    if (cleaned.length === 0 || cleaned === NO_ROOM) {
        return { roomNames: [], unknownRooms: [] };
    }

    const candidates = expandRoomRange(cleaned).map(normalizeRoomName);

    const roomNames: string[] = [];
    const unknownRooms: string[] = [];

    for (const candidate of candidates) {
        if (candidate.length === 0) continue;
        if (isKnownRoom(candidate)) {
            if (!roomNames.includes(candidate)) roomNames.push(candidate);
        } else if (!unknownRooms.includes(candidate)) {
            unknownRooms.push(candidate);
        }
    }

    return { roomNames, unknownRooms };
}

/**
 * Développe une notation abrégée de deux salles.
 *
 * Le suffixe remplace la fin du premier nom : `108-9` → `108` + `109`,
 * `111-2` → `111` + `112`, `104-5` → `104` + `105`.
 * (L'ancienne implémentation faisait « premier numéro + 1 », ce qui ne
 * tombait juste que par coïncidence sur les salles actuelles.)
 */
export function expandRoomRange(location: string): string[] {
    const separatorIndex = location.indexOf("-");
    if (separatorIndex === -1) return [location];

    const base = location.slice(0, separatorIndex).trim();
    const suffix = location.slice(separatorIndex + 1).trim();

    if (base.length === 0 || suffix.length === 0 || suffix.length >= base.length) {
        return [location];
    }

    const second = base.slice(0, base.length - suffix.length) + suffix;
    return [base, second];
}

/**
 * Normalise un nom de salle isolé : `AC` → `AmphC`, `AmpB` → `AmphB`.
 */
export function normalizeRoomName(room: string): string {
    const cleaned = room.trim();
    if (cleaned.length === 0) return "";

    const amphi = cleaned.match(/^(?:A|Amp|Amph)([A-Z])$/i);
    if (amphi) return `Amph${amphi[1]!.toUpperCase()}`;

    return cleaned;
}
