// ============================================
// 📁 src/sync/importer.ts
// Insertion des cours en base, avec dédoublonnage
// ============================================

import { createHash } from "node:crypto";
import { In, IsNull, Not } from "typeorm";
import dataSource from "../utils/dataSource.js";
import { EdtSource } from "../entities/edtSource.entity.js";
import { Lesson } from "../entities/lesson.entity.js";
import { LessonGroup } from "../entities/lessonGroup.entity.js";
import { Room } from "../entities/room.entity.js";
import { StudentGroup } from "../entities/studentGroup.entity.js";
import { Subject } from "../entities/subject.entity.js";
import { Teacher } from "../entities/teacher.entity.js";
import { parseGroupCode } from "./groups.js";
import type { ParsedLesson, SourceFile } from "./types.js";
import type { Year } from "../entities/enums.js";

/**
 * Empreinte d'un cours, indépendante du fichier qui le publie.
 *
 * C'est la clé du dédoublonnage : un cours de promotion apparaît à l'identique
 * dans l'emploi du temps de chaque groupe, il ne doit être stocké qu'une fois.
 */
export function computeDedupKey(lesson: ParsedLesson): string {
    const canonical = [
        lesson.start.toISOString(),
        lesson.end.toISOString(),
        lesson.type,
        lesson.subjectCode,
        lesson.teacherName ?? "",
        [...lesson.roomNames].sort().join("+"),
    ].join("|");

    return createHash("sha1").update(canonical).digest("hex");
}

/**
 * Caches d'un passage de synchronisation : les mêmes matières, enseignants,
 * salles et groupes reviennent dans tous les fichiers.
 */
export class ImportCaches {
    readonly subjects = new Map<string, number>();
    readonly teachers = new Map<string, number>();
    readonly rooms = new Map<string, Room>();
    readonly groups = new Map<string, number>();

    /**
     * Charge le référentiel de salles. Les salles ne sont jamais créées depuis
     * un emploi du temps : elles viennent du seed.
     */
    async loadRooms(): Promise<void> {
        for (const room of await dataSource.getRepository(Room).find()) {
            this.rooms.set(room.name, room);
        }
    }
}

export interface ImportOutcome {
    lessonsCreated: number;
    lessonsLinked: number;
}

/**
 * Importe les cours lus dans un fichier.
 *
 * Les cours communs à plusieurs groupes ne sont stockés qu'une fois : seul le
 * rattachement au groupe est propre à chaque fichier.
 */
export class Importer {
    public static instance: Importer = new Importer();

    /**
     * Retrouve (ou crée) la ligne de suivi d'un fichier.
     */
    async getOrCreateSource(file: SourceFile): Promise<EdtSource> {
        const sources = dataSource.getRepository(EdtSource);

        const existing = await sources.findOneBy({
            scope: file.scope,
            weekNumber: file.weekNumber,
            format: file.format,
        });

        if (existing) return existing;

        return sources.save(
            sources.create({
                year: file.year,
                scope: file.scope,
                weekNumber: file.weekNumber,
                format: file.format,
                url: file.url,
            }),
        );
    }

    /**
     * Enregistre les cours d'un fichier et les rattache à leurs groupes.
     */
    async importLessons(
        caches: ImportCaches,
        source: EdtSource,
        lessons: ParsedLesson[],
        year: Year,
    ): Promise<ImportOutcome> {
        // Le fichier a pu être republié avec des cours en moins : on repart de
        // ses seuls rattachements, sans toucher à ceux des autres fichiers.
        await dataSource.getRepository(LessonGroup).delete({ sourceId: source.id });

        let lessonsCreated = 0;
        let lessonsLinked = 0;

        for (const parsed of lessons) {
            const lessonId = await this.upsertLesson(caches, parsed);
            if (lessonId.created) lessonsCreated += 1;

            for (const groupCode of parsed.groupCodes) {
                const groupId = await this.upsertGroup(caches, groupCode, year);
                await this.link(lessonId.id, groupId, source.id);
                lessonsLinked += 1;
            }
        }

        await dataSource.getRepository(EdtSource).update(source.id, { importedAt: new Date() });

        return { lessonsCreated, lessonsLinked };
    }

    /**
     * Crée le cours s'il n'existe pas déjà sous la même empreinte.
     */
    private async upsertLesson(
        caches: ImportCaches,
        parsed: ParsedLesson,
    ): Promise<{ id: number; created: boolean }> {
        const lessons = dataSource.getRepository(Lesson);
        const dedupKey = computeDedupKey(parsed);

        const rooms = parsed.roomNames
            .map((name) => caches.rooms.get(name))
            .filter((room): room is Room => room !== undefined);

        const existing = await lessons.findOne({ where: { dedupKey }, relations: { rooms: true } });
        if (existing) {
            await this.attachMissingRooms(existing, rooms);
            return { id: existing.id, created: false };
        }

        const subject = await this.upsertSubject(caches, parsed.subjectCode, parsed.subjectLabel);
        const teacher = parsed.teacherName ? await this.upsertTeacher(caches, parsed.teacherName) : null;

        const saved = await lessons.save(
            lessons.create({
                dedupKey,
                startUtc: parsed.start,
                endUtc: parsed.end,
                type: parsed.type,
                subject: { id: subject } as never,
                teacher: teacher === null ? null : ({ id: teacher } as never),
                rawContent: parsed.rawContent.slice(0, 255),
                rooms,
            }),
        );

        return { id: saved.id, created: true };
    }

    /**
     * Rattache les salles qu'un cours déjà enregistré n'a pas.
     *
     * L'empreinte est calculée sur ce que le document annonce, pas sur ce qui a
     * pu être enregistré : un cours importé alors que le référentiel de salles
     * était vide garde la même empreinte, et resterait donc sans occupation à
     * toutes les synchronisations suivantes. Sans ce rattrapage, seule une purge
     * de la table rendrait leurs salles à ces cours.
     */
    private async attachMissingRooms(lesson: Lesson, rooms: Room[]): Promise<void> {
        const known = new Set((lesson.rooms ?? []).map((room) => room.id));
        const missing = rooms.filter((room) => !known.has(room.id));
        if (missing.length === 0) return;

        lesson.rooms = [...(lesson.rooms ?? []), ...missing];
        await dataSource.getRepository(Lesson).save(lesson);
    }

    private async upsertSubject(caches: ImportCaches, code: string, label: string): Promise<number> {
        const cached = caches.subjects.get(code);
        if (cached !== undefined) return cached;

        const subjects = dataSource.getRepository(Subject);
        const existing = await subjects.findOneBy({ code });
        const saved = await subjects.save({ ...(existing ?? {}), code, label });

        caches.subjects.set(code, saved.id);
        return saved.id;
    }

    /**
     * Chaque forme rencontrée est enregistrée telle quelle : un nouvel
     * enseignant apparaît tout seul, sans intervention.
     */
    private async upsertTeacher(caches: ImportCaches, name: string): Promise<number> {
        const cached = caches.teachers.get(name);
        if (cached !== undefined) return cached;

        const teachers = dataSource.getRepository(Teacher);
        const existing = await teachers.findOneBy({ name });
        const saved = existing ?? (await teachers.save({ name }));

        caches.teachers.set(name, saved.id);
        return saved.id;
    }

    private async upsertGroup(caches: ImportCaches, code: string, year: Year): Promise<number> {
        const cached = caches.groups.get(code);
        if (cached !== undefined) return cached;

        const parsed = parseGroupCode(code);
        if (!parsed) throw new Error(`Code de groupe illisible : ${code}`);

        const groups = dataSource.getRepository(StudentGroup);
        const existing = await groups.findOneBy({ code });
        const saved = await groups.save({
            ...(existing ?? {}),
            code,
            year,
            mainGroup: parsed.mainGroup,
            subGroup: parsed.subGroup,
        });

        caches.groups.set(code, saved.id);
        return saved.id;
    }

    private async link(lessonId: number, groupId: number, sourceId: number): Promise<void> {
        await dataSource
            .getRepository(LessonGroup)
            .createQueryBuilder()
            .insert()
            .values({ lessonId, groupId, sourceId })
            .orIgnore()
            .execute();
    }

    /**
     * Supprime les cours qui ne sont plus rattachés à aucun groupe, par exemple
     * après la republication d'un emploi du temps où ils ont disparu.
     */
    async deleteOrphanLessons(): Promise<number> {
        const result = await dataSource
            .getRepository(Lesson)
            .createQueryBuilder()
            .delete()
            .where("id NOT IN (SELECT lesson_id FROM lesson_group)")
            .execute();

        return result.affected ?? 0;
    }

    /**
     * Met à jour les métadonnées de cache d'un fichier après téléchargement.
     */
    async updateSourceHeaders(
        sourceId: number,
        values: {
            url: string;
            etag: string | null;
            lastModified: string | null;
            contentHash: string;
            backupPath: string | null;
        },
    ): Promise<void> {
        await dataSource.getRepository(EdtSource).update(sourceId, { ...values, fetchedAt: new Date() });
    }

    /** Marque un fichier comme vérifié alors qu'il n'a pas changé (304). */
    async touchSource(sourceId: number): Promise<void> {
        await dataSource.getRepository(EdtSource).update(sourceId, { fetchedAt: new Date() });
    }
}

export default Importer.instance;
