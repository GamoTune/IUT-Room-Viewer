// ============================================
// 📁 src/repository/source.repository.ts
// Accès aux documents suivis
// ============================================

import { In } from "typeorm";
import dataSource from "../utils/dataSource.js";
import { EdtSource } from "../entities/edtSource.entity.js";
import { Lesson } from "../entities/lesson.entity.js";
import type { Year } from "../entities/enums.js";

/**
 * Repository des documents publiés par l'IUT.
 */
export class SourceRepository {
    public static instance: SourceRepository = new SourceRepository();

    /**
     * Numéro de la semaine couverte par la période, lu dans le document d'année
     * dont des cours y tombent.
     *
     * Les documents ne portent pas leur date — seul leur nom indique la semaine
     * depuis la rentrée. Ce sont les cours importés qui la situent dans le
     * calendrier.
     */
    async findWeekNumber(year: Year, from: Date, to: Date): Promise<number | null> {
        const row = await dataSource
            .createQueryBuilder(Lesson, "lesson")
            .innerJoin("lesson_group", "lg", "lg.lesson_id = lesson.id")
            .innerJoin(EdtSource, "source", "source.id = lg.source_id")
            .select("source.week_number", "weekNumber")
            // `year` est un enum et `scope` du texte : un même paramètre pour les deux
            // serait typé à la première comparaison et refusé à la seconde.
            .where("source.year = :year AND source.scope = :scope AND source.format = 'pdf'", { year, scope: year })
            .andWhere("lesson.start_utc >= :from AND lesson.start_utc < :to", { from, to })
            .orderBy("source.week_number", "DESC")
            .getRawOne<{ weekNumber: number | string }>();

        return row ? Number(row.weekNumber) : null;
    }

    /** Documents d'une semaine pour les périmètres demandés, tous formats confondus. */
    async findFiles(weekNumber: number, scopes: string[]): Promise<EdtSource[]> {
        if (scopes.length === 0) return [];

        return dataSource.getRepository(EdtSource).find({
            where: { weekNumber, scope: In(scopes) },
        });
    }
}

export default SourceRepository.instance;
