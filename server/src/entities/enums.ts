// ============================================
// 📁 src/entities/enums.ts
// Énumérations partagées par les entités
// ============================================

/** Années de formation publiées par l'IUT. */
export const YEARS = ["A1", "A2", "A3"] as const;
export type Year = (typeof YEARS)[number];

/**
 * Types de cours. `Cours` dans les documents correspond à un CM ;
 * `OTHER` accueille ce que l'IUT publiera en cours d'année (examens, soutenances).
 */
export const LESSON_TYPES = ["CM", "TD", "TP", "OTHER"] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

/** Catégories de salles, pour l'affichage groupé par étage. */
export const ROOM_KINDS = ["salle", "amphi"] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

/**
 * Format d'un fichier d'emploi du temps.
 * Seul `pdf` alimente la base ; `ics` reste suivi pour détecter le jour où
 * l'IUT corrigera ces fichiers.
 */
export const SOURCE_FORMATS = ["pdf", "ics"] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];
