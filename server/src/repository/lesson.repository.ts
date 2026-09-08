// ============================================
// 📁 src/repository/lesson.repository.ts
// Accès aux cours, partagé par les services de lecture
// ============================================

import { In, LessThan, LessThanOrEqual, MoreThan, MoreThanOrEqual, type FindOptionsWhere } from "typeorm";
import dataSource from "../utils/dataSource.js";
import { Lesson } from "../entities/lesson.entity.js";
import { Room } from "../entities/room.entity.js";
import { StudentGroup } from "../entities/studentGroup.entity.js";
import { Teacher } from "../entities/teacher.entity.js";

/**
 * Manière de confronter un cours à la fenêtre demandée.
 *
 * - `overlap`   : le cours croise la fenêtre (occupation d'une salle à un instant)
 * - `start`     : le cours commence dans la fenêtre (emploi du temps d'une journée)
 * - `contained` : le cours tient entièrement dans la fenêtre (export de cours)
 */
export type WindowMode = "overlap" | "start" | "contained";

export interface LessonFilter {
    from: Date;
    to: Date;
    mode: WindowMode;
    /** Codes de groupes tels que publiés (`G1a`, `G4b`...). */
    groupCodes?: string[];
    roomNames?: string[];
    /** Formes d'enseignant à retenir : noms, codes, ou les deux. */
    teacherNames?: string[];
}

/**
 * Effectifs des groupes, pour reconnaître un cours suivi par une promotion
 * entière ou par un groupe entier plutôt que par un seul sous-groupe.
 */
export interface GroupCensus {
    /** Nombre de sous-groupes par année : `A1` → 6 */
    perYear: Map<string, number>;
    /** Nombre de sous-groupes par groupe principal : `1` → 2 (G1a, G1b) */
    perMainGroup: Map<number, number>;
}

/**
 * Repository des cours.
 */
export class LessonRepository {
    public static instance: LessonRepository = new LessonRepository();

    /**
     * Récupère les cours du filtre, avec matière, enseignant, salles et groupes.
     */
    async findMany(filter: LessonFilter): Promise<Lesson[]> {
        const ids = await this.findIds(filter);
        if (ids.length === 0) return [];

        return dataSource.getRepository(Lesson).find({
            where: { id: In(ids) },
            relations: { subject: true, teacher: true, rooms: true, groups: { group: true } },
            order: { startUtc: "ASC" },
        });
    }

    /**
     * Identifie les cours retenus par le filtre.
     * Les critères sur les relations passent par des sous-requêtes, pour ne pas
     * multiplier les lignes ni tronquer les relations chargées ensuite.
     */
    private async findIds(filter: LessonFilter): Promise<number[]> {
        const query = dataSource
            .createQueryBuilder(Lesson, "lesson")
            .select("lesson.id", "id")
            .orderBy("lesson.start_utc", "ASC");

        this.applyWindow(query, filter);

        if (filter.groupCodes?.length) {
            query.andWhere(
                `EXISTS (SELECT 1 FROM lesson_group lg
                         JOIN student_group sg ON sg.id = lg.group_id
                         WHERE lg.lesson_id = lesson.id AND sg.code IN (:...groupCodes))`,
                { groupCodes: filter.groupCodes },
            );
        }

        if (filter.roomNames?.length) {
            query.andWhere(
                `EXISTS (SELECT 1 FROM lesson_room lr
                         JOIN room r ON r.id = lr.room_id
                         WHERE lr.lesson_id = lesson.id AND r.name IN (:...roomNames))`,
                { roomNames: filter.roomNames },
            );
        }

        if (filter.teacherNames?.length) {
            query.andWhere(
                `EXISTS (SELECT 1 FROM teacher t
                         WHERE t.id = lesson.teacher_id AND t.name IN (:...teacherNames))`,
                { teacherNames: filter.teacherNames },
            );
        }

        const rows = await query.getRawMany<{ id: number }>();
        return rows.map((row) => row.id);
    }

    /**
     * Ajoute la condition temporelle correspondant au mode demandé.
     *
     * `/salles_maintenant` interroge un instant (`from === to`) : un cours qui
     * commence pile à cet instant occupe déjà la salle, d'où le `<=`. Sur une
     * vraie fenêtre, un cours démarrant à `to` reste exclu.
     */
    private applyWindow(
        query: ReturnType<typeof dataSource.createQueryBuilder>,
        filter: LessonFilter,
    ): void {
        if (filter.mode === "start") {
            query.where("lesson.start_utc >= :from AND lesson.start_utc < :to", {
                from: filter.from,
                to: filter.to,
            });
            return;
        }

        if (filter.mode === "contained") {
            query.where("lesson.start_utc >= :from AND lesson.end_utc <= :to", {
                from: filter.from,
                to: filter.to,
            });
            return;
        }

        if (filter.from >= filter.to) {
            query.where("lesson.start_utc <= :instant AND lesson.end_utc > :instant", {
                instant: filter.from,
            });
            return;
        }

        query.where("lesson.start_utc < :to AND lesson.end_utc > :from", {
            from: filter.from,
            to: filter.to,
        });
    }

    /**
     * Toutes les salles du référentiel, dans l'ordre d'affichage.
     */
    async findAllRooms(): Promise<Room[]> {
        return dataSource.getRepository(Room).find({ order: { displayOrder: "ASC" } });
    }

    /**
     * Toutes les formes d'enseignant rencontrées dans les documents.
     */
    async findAllTeachers(): Promise<Teacher[]> {
        return dataSource.getRepository(Teacher).find({ order: { name: "ASC" } });
    }

    /**
     * Compte les sous-groupes par année et par groupe principal.
     */
    async loadGroupCensus(): Promise<GroupCensus> {
        const groups = await dataSource.getRepository(StudentGroup).find();

        const perYear = new Map<string, number>();
        const perMainGroup = new Map<number, number>();

        for (const group of groups) {
            perYear.set(group.year, (perYear.get(group.year) ?? 0) + 1);
            perMainGroup.set(group.mainGroup, (perMainGroup.get(group.mainGroup) ?? 0) + 1);
        }

        return { perYear, perMainGroup };
    }
}

export default LessonRepository.instance;
