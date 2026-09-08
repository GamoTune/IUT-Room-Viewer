// ============================================
// 📁 src/utils/dataSource.ts
// Connexion à la base (TypeORM / PostgreSQL)
// ============================================

import "reflect-metadata";
import { DataSource } from "typeorm";
import { EdtSource } from "../entities/edtSource.entity.js";
import { Lesson } from "../entities/lesson.entity.js";
import { LessonGroup } from "../entities/lessonGroup.entity.js";
import { Request } from "../entities/request.entity.js";
import { Room } from "../entities/room.entity.js";
import { StudentGroup } from "../entities/studentGroup.entity.js";
import { Subject } from "../entities/subject.entity.js";
import { Teacher } from "../entities/teacher.entity.js";
import { User } from "../entities/user.entity.js";

const url = process.env.DATABASE_URL;

if (!url) {
    throw new Error("DATABASE_URL est absent de l'environnement (voir server/.env)");
}

/**
 * Source de données de l'application.
 *
 * `synchronize` reste désactivé même en développement : le schéma n'évolue que
 * par migrations, pour que la base locale et celle de production suivent le
 * même chemin.
 */
const dataSource = new DataSource({
    type: "postgres",
    url,
    entities: [EdtSource, Lesson, LessonGroup, Request, Room, StudentGroup, Subject, Teacher, User],
    migrations: ["src/migrations/*.ts"],
    synchronize: false,
    logging: process.env.DB_LOGGING === "true",
});

// Un seul export de DataSource : le CLI de TypeORM refuse le fichier au-delà.
export default dataSource;

/**
 * Ouvre la connexion si elle ne l'est pas déjà.
 * Appelée au démarrage du serveur et par les commandes en ligne.
 */
export async function initializeDatabase(): Promise<DataSource> {
    if (!dataSource.isInitialized) {
        await dataSource.initialize();
    }
    return dataSource;
}

/** Ferme la connexion, pour que les commandes se terminent proprement. */
export async function closeDatabase(): Promise<void> {
    if (dataSource.isInitialized) {
        await dataSource.destroy();
    }
}
