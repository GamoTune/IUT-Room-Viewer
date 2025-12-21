// ============================================
// 📁 src/sync/sync.scheduler.ts
// Planificateur de synchronisation automatique
// ============================================

import cron from "node-cron";
import { SyncService } from "../services/sync.service.js";

/**
 * Planificateur de tâches pour la synchronisation automatique
 * Utilise node-cron pour exécuter la sync toutes les 10 minutes
 */
export class SyncScheduler {
    public static instance: SyncScheduler = new SyncScheduler();

    private cronJob: cron.ScheduledTask | null = null;
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
            console.log("\n⏰ [CRON] Synchronisation automatique déclenchée");
            try {
                await SyncService.instance.syncAll();
            } catch (error) {
                console.error("❌ [CRON] Erreur lors de la synchronisation:", error);
            }
        });

        this.isStarted = true;
        console.log("🔄 Scheduler de synchronisation démarré (toutes les 10 min)");
    }

    /**
     * Arrête le cron job
     */
    stop(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            this.isStarted = false;
            console.log("⏹️  Scheduler de synchronisation arrêté");
        }
    }

    /**
     * Vérifie si le scheduler est actif
     */
    getIsRunning(): boolean {
        return this.isStarted;
    }
}
