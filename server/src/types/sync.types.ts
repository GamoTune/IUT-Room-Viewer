// ============================================
// 📁 src/sync/sync.types.ts
// Types pour la synchronisation avec Unilim
// ============================================

import type { TimetableYear } from "unilim/iut/cs/timetable";

/**
 * Résultat d'une opération de synchronisation
 */
export interface SyncResult {
    success: boolean;
    year: TimetableYear;
    weekNumber: number;
    lessonsAdded: number;
    lessonsUpdated: number;
    skipped: boolean;
    message: string;
}

/**
 * Résultat global d'une synchronisation complète
 */
export interface SyncSummary {
    success: boolean;
    startedAt: Date;
    completedAt: Date;
    totalEdtProcessed: number;
    totalEdtSkipped: number;
    totalLessonsProcessed: number;
    errors: string[];
}

/**
 * Données formatées d'un cours prêtes pour l'insertion en BDD
 */
export interface FormattedLesson {
    type: string;
    startDatetime: Date;
    endDatetime: Date;
    contentCode: string;
    contentName: string;
    teacherName: string | null;
    roomName: string | null;
    mainGroup: number;
    subGroup: number;
}

/**
 * Statut de synchronisation en mémoire
 */
export interface SyncStatus {
    isRunning: boolean;
    lastSync: SyncSummary | null;
}
