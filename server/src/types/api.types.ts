// ============================================
// 📁 src/types/api.types.ts
// Types pour les requêtes/réponses API
// ============================================

/**
 * Réponse API standard
 * Toutes les réponses suivent ce format
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Paramètres de plage horaire (utilisés dans les query params)
 */
export interface TimeRangeQuery {
    startTime: string;  // ISO datetime string
    endTime: string;    // ISO datetime string
}