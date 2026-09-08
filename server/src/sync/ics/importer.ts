// ============================================
// 📁 src/sync/ics/importer.ts
// Insertion des cours en base, avec dédoublonnage
// ============================================

import { and, eq, notExists, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
    icsSource,
    lesson,
    lessonGroup,
    lessonRoom,
    room,
    studentGroup,
    subject,
    teacher,
} from "../../db/schema.js";
import { parseGroupCode } from "./listing.js";
import { computeDedupKey } from "./normalize.js";
import type { IcsFileEntry, ParsedLesson } from "./types.js";

/**
 * Caches d'un passage de synchronisation : les mêmes matières, enseignants et
 * salles reviennent dans tous les fichiers, inutile de réinterroger la base.
 */
export class ImportCaches {
    readonly subjects = new Map<string, number>();
    readonly teachers = new Map<string, number>();
    readonly rooms = new Map<string, number>();
    readonly groups = new Map<string, number>();

    /**
     * Charge le référentiel de salles. Les salles ne sont jamais créées depuis
     * un ICS : elles viennent du seed.
     */
    async loadRooms(): Promise<void> {
        const rows = await db.select({ id: room.id, name: room.name }).from(room);
        for (const row of rows) this.rooms.set(row.name, row.id);
    }
}

async function upsertSubject(caches: ImportCaches, code: string, label: string): Promise<number> {
    const cached = caches.subjects.get(code);
    if (cached !== undefined) return cached;

    const [row] = await db
        .insert(subject)
        .values({ code, label })
        .onConflictDoUpdate({ target: subject.code, set: { label } })
        .returning({ id: subject.id });

    if (!row) throw new Error(`Matière non insérée : ${code}`);

    caches.subjects.set(code, row.id);
    return row.id;
}

async function upsertTeacher(caches: ImportCaches, name: string): Promise<number> {
    const cached = caches.teachers.get(name);
    if (cached !== undefined) return cached;

    // Chaque forme rencontrée est enregistrée telle quelle, sans chercher à la
    // rapprocher d'une autre : un nouvel enseignant apparaît donc tout seul.
    const [row] = await db
        .insert(teacher)
        .values({ name })
        .onConflictDoUpdate({ target: teacher.name, set: { name } })
        .returning({ id: teacher.id });

    if (!row) throw new Error(`Enseignant non inséré : ${name}`);

    caches.teachers.set(name, row.id);
    return row.id;
}

export async function upsertStudentGroup(
    caches: ImportCaches,
    file: IcsFileEntry,
): Promise<number> {
    const cached = caches.groups.get(file.groupCode);
    if (cached !== undefined) return cached;

    const parsed = parseGroupCode(file.groupCode);
    if (!parsed) throw new Error(`Code de groupe illisible : ${file.groupCode}`);

    const [row] = await db
        .insert(studentGroup)
        .values({
            code: file.groupCode,
            year: file.year,
            mainGroup: parsed.mainGroup,
            subGroup: parsed.subGroup,
        })
        .onConflictDoUpdate({
            target: studentGroup.code,
            set: { year: file.year, mainGroup: parsed.mainGroup, subGroup: parsed.subGroup },
        })
        .returning({ id: studentGroup.id });

    if (!row) throw new Error(`Groupe non inséré : ${file.groupCode}`);

    caches.groups.set(file.groupCode, row.id);
    return row.id;
}

export interface SourceState {
    id: number;
    etag: string | null;
    lastModified: string | null;
    contentHash: string | null;
}

/**
 * Retrouve (ou crée) la ligne de suivi d'un fichier ICS.
 */
export async function getOrCreateSource(file: IcsFileEntry): Promise<SourceState> {
    const columns = {
        id: icsSource.id,
        etag: icsSource.etag,
        lastModified: icsSource.lastModified,
        contentHash: icsSource.contentHash,
    };

    const [existing] = await db
        .select(columns)
        .from(icsSource)
        .where(
            and(
                eq(icsSource.year, file.year),
                eq(icsSource.groupCode, file.groupCode),
                eq(icsSource.weekNumber, file.weekNumber),
            ),
        )
        .limit(1);

    if (existing) return existing;

    const [created] = await db
        .insert(icsSource)
        .values({
            year: file.year,
            groupCode: file.groupCode,
            weekNumber: file.weekNumber,
            url: file.url,
        })
        .returning(columns);

    if (!created) throw new Error(`Source non insérée : ${file.fileName}`);
    return created;
}

export interface ImportOutcome {
    lessonsCreated: number;
    lessonsLinked: number;
}

/**
 * Importe le contenu d'un fichier ICS.
 *
 * Les cours communs à plusieurs groupes (CM de promo, publiés à l'identique
 * dans l'ICS de chaque sous-groupe) sont stockés une seule fois : seul le
 * rattachement au groupe est propre à chaque fichier.
 */
export async function importLessons(
    caches: ImportCaches,
    file: IcsFileEntry,
    sourceId: number,
    groupId: number,
    lessons: ParsedLesson[],
): Promise<ImportOutcome> {
    // Le fichier a pu être republié avec des cours en moins : on repart de ses
    // seuls rattachements, sans toucher à ceux des autres groupes.
    await db.delete(lessonGroup).where(eq(lessonGroup.sourceId, sourceId));

    let lessonsCreated = 0;
    let lessonsLinked = 0;

    for (const parsed of lessons) {
        const dedupKey = computeDedupKey(parsed);

        const subjectId = await upsertSubject(caches, parsed.subjectCode, parsed.subjectLabel);
        const teacherId = parsed.teacherName
            ? await upsertTeacher(caches, parsed.teacherName)
            : null;

        const [existing] = await db
            .select({ id: lesson.id })
            .from(lesson)
            .where(eq(lesson.dedupKey, dedupKey))
            .limit(1);

        let lessonId = existing?.id;

        if (lessonId === undefined) {
            const [created] = await db
                .insert(lesson)
                .values({
                    dedupKey,
                    startUtc: parsed.start,
                    endUtc: parsed.end,
                    type: parsed.type,
                    subjectId,
                    teacherId,
                    rawSummary: parsed.rawSummary,
                })
                .onConflictDoUpdate({
                    target: lesson.dedupKey,
                    set: { subjectId, teacherId, rawSummary: parsed.rawSummary },
                })
                .returning({ id: lesson.id });

            if (!created) throw new Error(`Cours non inséré : ${dedupKey}`);

            lessonId = created.id;
            lessonsCreated += 1;

            for (const roomName of parsed.roomNames) {
                const roomId = caches.rooms.get(roomName);
                if (roomId === undefined) continue;

                await db
                    .insert(lessonRoom)
                    .values({ lessonId, roomId })
                    .onConflictDoNothing();
            }
        }

        await db
            .insert(lessonGroup)
            .values({ lessonId, groupId, sourceId })
            .onConflictDoNothing();

        lessonsLinked += 1;
    }

    await db
        .update(icsSource)
        .set({ importedAt: new Date() })
        .where(eq(icsSource.id, sourceId));

    return { lessonsCreated, lessonsLinked };
}

/**
 * Supprime les cours qui ne sont plus rattachés à aucun groupe, par exemple
 * après la republication d'un EDT où ils ont disparu.
 * `lesson_room` suit en cascade.
 */
export async function deleteOrphanLessons(): Promise<number> {
    const result = await db.delete(lesson).where(
        notExists(
            db
                .select({ one: sql`1` })
                .from(lessonGroup)
                .where(eq(lessonGroup.lessonId, lesson.id)),
        ),
    );

    return result.rowCount ?? 0;
}

/**
 * Met à jour les métadonnées de cache d'une source après téléchargement.
 */
export async function updateSourceHeaders(
    sourceId: number,
    values: { url: string; etag: string | null; lastModified: string | null; contentHash: string; backupPath: string | null },
): Promise<void> {
    await db
        .update(icsSource)
        .set({
            url: values.url,
            etag: values.etag,
            lastModified: values.lastModified,
            contentHash: values.contentHash,
            backupPath: values.backupPath,
            fetchedAt: new Date(),
        })
        .where(eq(icsSource.id, sourceId));
}

/**
 * Marque une source comme vérifiée alors qu'elle n'a pas changé (304).
 */
export async function touchSource(sourceId: number): Promise<void> {
    await db.update(icsSource).set({ fetchedAt: new Date() }).where(eq(icsSource.id, sourceId));
}
