// ============================================
// 📁 src/sync/ics/types.ts
// Types de la chaîne de synchronisation ICS
// ============================================

import type { LessonType, Year } from "../../db/schema.js";

/**
 * Un fichier ICS repéré dans le listing distant.
 */
export interface IcsFileEntry {
    year: Year;
    groupCode: string;
    weekNumber: number;
    fileName: string;
    url: string;
}

/**
 * Un VEVENT brut, avant toute interprétation du contenu.
 */
export interface RawIcsEvent {
    uid: string | null;
    start: Date;
    end: Date;
    summary: string;
    location: string;
}

/**
 * Un cours interprété, prêt à être inséré.
 */
export interface ParsedLesson {
    start: Date;
    end: Date;
    type: LessonType;
    subjectCode: string;
    subjectLabel: string;
    teacherInitials: string | null;
    roomNames: string[];
    /** Salles citées par l'ICS mais absentes du référentiel. */
    unknownRooms: string[];
    rawSummary: string;
    rawLocation: string;
    /** `true` quand le SUMMARY ne suit pas la forme attendue. */
    degraded: boolean;
}

/**
 * Résultat de la récupération d'un fichier.
 */
export type FetchOutcome =
    | { status: "unchanged" }
    | {
          status: "downloaded";
          content: string;
          etag: string | null;
          lastModified: string | null;
          contentHash: string;
          backupPath: string | null;
      };

/**
 * Bilan de la synchronisation d'un fichier.
 */
export interface FileSyncResult {
    file: IcsFileEntry;
    skipped: boolean;
    eventsParsed: number;
    lessonsLinked: number;
    lessonsCreated: number;
    unparsedSummaries: string[];
    unknownRooms: string[];
    error?: string;
}

/**
 * Bilan d'un passage complet.
 */
export interface SyncSummary {
    success: boolean;
    startedAt: Date;
    completedAt: Date;
    filesDiscovered: number;
    filesDownloaded: number;
    filesSkipped: number;
    lessonsCreated: number;
    lessonsLinked: number;
    unparsedSummaries: string[];
    unknownRooms: string[];
    errors: string[];
    /** Détail par fichier, dans l'ordre de traitement. */
    files: FileSyncResult[];
}

/**
 * Statut de synchronisation, conservé en mémoire.
 */
export interface SyncStatus {
    isRunning: boolean;
    lastSync: SyncSummary | null;
}
