// ============================================
// 📁 src/index.ts
// Point d'entrée principal de l'application
// ============================================

import "dotenv/config";
import { app } from "./api/app.js";
import { SyncScheduler } from "./sync/sync.scheduler.js";

/**
 * Démarre le serveur Express
 */
async function main() {
    const port = parseInt(process.env.PORT || "3000", 10);
    const host = process.env.HOST || "0.0.0.0";

    app.listen(port, host, () => {
        console.log(`🚀 API démarrée sur http://${host}:${port}`);
        console.log(`📋 Endpoints:`);
        console.log(`   - GET /health`);
        console.log(`   - GET /api/v1/rooms`);
        console.log(`   - GET /api/v1/rooms/availability`);
        console.log(`   - POST /api/v1/sync/trigger`);
        console.log(`   - GET /api/v1/sync/status`);
    });

    // Démarrer la synchronisation automatique
    SyncScheduler.instance.start();
}

// Lancer le serveur
main().catch((error) => {
    console.error("Erreur au démarrage:", error);
    process.exit(1);
});
