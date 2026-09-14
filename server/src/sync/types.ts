// ============================================
// 📁 src/sync/types.ts
// Types de la chaîne de synchronisation
// ============================================

import type { LessonType, SourceFormat, Year } from "../entities/enums.js";

/**
 * Un fichier d'emploi du temps repéré dans le listing distant.
 */
export interface SourceFile {
    year: Year;
    /** Dossier d'origine : une année (`A1`) ou un sous-groupe (`G1a`). */
    scope: string;
    weekNumber: number;
    format: SourceFormat;
    fileName: string;
    url: string;
}

/**
 * Un cours interprété, prêt à être inséré.
 *
 * Les documents d'année portent les cours de tous les groupes : chaque cours
 * transporte donc les groupes qu'il concerne.
 */
export interface ParsedLesson {
    start: Date;
    end: Date;
    type: LessonType;
    subjectCode: string;
    subjectLabel: string;
    /** Nom ou code de l'enseignant, tel qu'écrit dans le document. */
    teacherName: string | null;
    roomNames: string[];
    /** Salles citées par le document mais absentes du référentiel. */
    unknownRooms: string[];
    /** Codes des groupes concernés (`G1a`, `G1b`...). */
    groupCodes: string[];
    /** Contenu brut de la case, pour diagnostiquer une lecture douteuse. */
    rawContent: string;
    /** `true` quand le contenu n'a pas pu être interprété complètement. */
    degraded: boolean;
}

/**
 * Résultat de la récupération d'un fichier.
 */
export type FetchOutcome =
    | { status: "unchanged" }
    | {
          status: "downloaded";
          content: Uint8Array;
          etag: string | null;
          lastModified: string | null;
          contentHash: string;
          backupPath: string | null;
      };

/** Bilan de la synchronisation d'un fichier. */
export interface FileSyncResult {
    file: SourceFile;
    skipped: boolean;
    lessonsParsed: number;
    lessonsCreated: number;
    lessonsLinked: number;
    unreadableCells: string[];
    unknownRooms: string[];
    error?: string;
}

/** Bilan d'un passage complet. */
export interface SyncSummary {
    success: boolean;
    startedAt: Date;
    completedAt: Date;
    filesDiscovered: number;
    filesDownloaded: number;
    filesSkipped: number;
    lessonsCreated: number;
    lessonsLinked: number;
    unreadableCells: string[];
    unknownRooms: string[];
    errors: string[];
    files: FileSyncResult[];
}

/** Statut de synchronisation, conservé en mémoire. */
export interface SyncStatus {
    isRunning: boolean;
    lastSync: SyncSummary | null;
}
