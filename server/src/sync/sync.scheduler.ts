// ============================================
// 📁 src/sync/sync.scheduler.ts
// Planificateur de synchronisation automatique
// ============================================

import cron from "node-cron";
import syncService from "./sync.service.js";

/**
 * Planificateur de tâches pour la synchronisation automatique
 * Utilise node-cron pour exécuter la sync toutes les 10 minutes
 */
export class SyncScheduler {
    public static instance: SyncScheduler = new SyncScheduler();

    private cronJob: ReturnType<typeof cron.schedule> | null = null;
    private archiveJob: ReturnType<typeof cron.schedule> | null = null;
    private isStarted = false;

    /**
     * Démarre le cron job de synchronisation
     * Expression: toutes les 10 minutes
     */
    start(): void {
        if (this.isStarted) {
            console.log("⚠️  Le scheduler de sync est déjà démarré");
            return;
        }

        // Cron expression: toutes les 10 minutes
        this.cronJob = cron.schedule("*/10 * * * *", async () => {
            // Vérifier si une sync est déjà en cours
            const status = syncService.getStatus();
            if (status.isRunning) {
                console.log("⏰ [CRON] Sync en cours, on passe ce cycle");
                return;
            }

            console.log("\n⏰ [CRON] Synchronisation automatique déclenchée");
            try {
                await syncService.syncAll();
            } catch (error) {
                console.error("❌ [CRON] Erreur lors de la synchronisation:", error);
            }
        });

        // Les fichiers non exploités ne bougent qu'au fil des semaines : une
        // vérification quotidienne suffit, et épargne le serveur de l'IUT.
        this.archiveJob = cron.schedule("30 4 * * *", async () => {
            if (syncService.getStatus().isRunning) return;

            console.log("\n🗂️  [CRON] Archivage des fichiers non exploités");
            try {
                await syncService.syncAll({ archiveOthers: true });
            } catch (error) {
                console.error("❌ [CRON] Erreur lors de l'archivage:", error);
            }
        });

        this.isStarted = true;
        console.log("🔄 Scheduler de synchronisation démarré (toutes les 10 min, archivage à 4h30)");
    }

    /**
     * Arrête le cron job
     */
    stop(): void {
        if (!this.cronJob && !this.archiveJob) return;

        this.cronJob?.stop();
        this.archiveJob?.stop();
        this.cronJob = null;
        this.archiveJob = null;
        this.isStarted = false;
        console.log("⏹️  Scheduler de synchronisation arrêté");
    }

    /**
     * Vérifie si le scheduler est actif
     */
    getIsRunning(): boolean {
        return this.isStarted;
    }
}
