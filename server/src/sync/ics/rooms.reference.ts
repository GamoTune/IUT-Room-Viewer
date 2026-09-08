// ============================================
// 📁 src/sync/ics/rooms.reference.ts
// Référentiel des salles du département informatique
// ============================================

import type { RoomKind } from "../../db/schema.js";

export interface RoomReference {
    name: string;
    floor: number;
    kind: RoomKind;
    displayOrder: number;
}

/**
 * Salles connues du département, dans l'ordre d'affichage.
 *
 * Source : l'ancien `data/rooms.json` du projet, complété par les amphis
 * (présents dans les ICS sous les codes `AB` / `AC`).
 *
 * C'est volontairement une liste figée : les salles ne sont jamais créées
 * depuis un ICS. Une salle absente d'ici mais citée dans un EDT est signalée
 * comme inconnue, ce qui rend visible tout changement côté IUT.
 */
export const ROOM_REFERENCE: RoomReference[] = [
    // Rez-de-chaussée
    { name: "R46", floor: 0, kind: "salle", displayOrder: 10 },
    { name: "R47", floor: 0, kind: "salle", displayOrder: 20 },
    { name: "R50", floor: 0, kind: "salle", displayOrder: 30 },
    { name: "R51", floor: 0, kind: "salle", displayOrder: 40 },
    { name: "R52", floor: 0, kind: "salle", displayOrder: 50 },

    // 1er étage
    { name: "103", floor: 1, kind: "salle", displayOrder: 110 },
    { name: "104", floor: 1, kind: "salle", displayOrder: 120 },
    { name: "105", floor: 1, kind: "salle", displayOrder: 130 },
    { name: "108", floor: 1, kind: "salle", displayOrder: 140 },
    { name: "109", floor: 1, kind: "salle", displayOrder: 150 },
    { name: "111", floor: 1, kind: "salle", displayOrder: 160 },
    { name: "112", floor: 1, kind: "salle", displayOrder: 170 },

    // 2ème étage
    { name: "205", floor: 2, kind: "salle", displayOrder: 210 },
    { name: "206", floor: 2, kind: "salle", displayOrder: 220 },
    { name: "208", floor: 2, kind: "salle", displayOrder: 230 },
    { name: "209", floor: 2, kind: "salle", displayOrder: 240 },

    // Amphithéâtres
    { name: "AmphB", floor: 0, kind: "amphi", displayOrder: 310 },
    { name: "AmphC", floor: 0, kind: "amphi", displayOrder: 320 },
];

const KNOWN_ROOM_NAMES = new Set(ROOM_REFERENCE.map((entry) => entry.name));

export function isKnownRoom(name: string): boolean {
    return KNOWN_ROOM_NAMES.has(name);
}
