// ============================================
// 📁 src/db/schema.ts
// Schéma de la base EDT (Drizzle / PostgreSQL)
// ============================================

import {
    boolean,
    index,
    integer,
    pgEnum,
    pgTable,
    primaryKey,
    smallint,
    text,
    timestamp,
    unique,
    varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Années de formation publiées par l'IUT.
 */
export const YEARS = ["A1", "A2", "A3"] as const;
export type Year = (typeof YEARS)[number];

/**
 * Types de cours. `Cours` dans les ICS correspond à un CM.
 * `OTHER` accueille tout ce que l'IUT publiera en cours d'année (DS, examens...).
 */
export const LESSON_TYPES = ["CM", "TD", "TP", "OTHER"] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

/**
 * Catégories de salles, utilisées pour l'affichage groupé par étage.
 */
export const ROOM_KINDS = ["salle", "amphi"] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

export const yearEnum = pgEnum("year", YEARS);
export const lessonTypeEnum = pgEnum("lesson_type", LESSON_TYPES);
export const roomKindEnum = pgEnum("room_kind", ROOM_KINDS);

/**
 * Un fichier ICS distant, identifié par (année, groupe, semaine).
 * `etag` et `last_modified` servent aux requêtes conditionnelles :
 * tant que le serveur répond 304, il n'y a rien à re-parser.
 */
export const icsSource = pgTable(
    "ics_source",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        year: yearEnum("year").notNull(),
        groupCode: varchar("group_code", { length: 10 }).notNull(),
        weekNumber: smallint("week_number").notNull(),
        url: text("url").notNull(),
        etag: varchar("etag", { length: 128 }),
        lastModified: varchar("last_modified", { length: 64 }),
        contentHash: varchar("content_hash", { length: 40 }),
        backupPath: text("backup_path"),
        fetchedAt: timestamp("fetched_at", { withTimezone: true }),
        importedAt: timestamp("imported_at", { withTimezone: true }),
    },
    (table) => [
        unique("ics_source_unique").on(table.year, table.groupCode, table.weekNumber),
    ],
);

/**
 * Référentiel des salles du département.
 * Alimenté par un seed et jamais par la synchronisation : une salle inconnue
 * dans un ICS est signalée, pas créée, pour éviter de polluer l'affichage.
 */
export const room = pgTable("room", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 20 }).notNull().unique(),
    floor: smallint("floor").notNull(),
    kind: roomKindEnum("kind").notNull().default("salle"),
    displayOrder: smallint("display_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
});

/**
 * Enseignant, enregistré tel qu'il apparaît dans la source.
 *
 * Les documents de l'IUT désignent le même enseignant tantôt par un nom
 * (`Onete C.`), tantôt par un code (`CO`), et la correspondance entre les deux
 * n'est pas systématique. On ne cherche donc pas à les rapprocher : chaque
 * forme rencontrée devient une entrée, créée à la volée. Une recherche peut
 * porter sur plusieurs formes à la fois et en réunir les résultats.
 */
export const teacher = pgTable("teacher", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 100 }).notNull().unique(),
});

/**
 * Matière / module (`R1.01`, `S3.01A`, mais aussi `FERIE` ou `SCO`).
 */
export const subject = pgTable("subject", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    label: varchar("label", { length: 150 }).notNull(),
});

/**
 * Groupe d'étudiants tel que publié : `G1a` = groupe 1, sous-groupe A.
 */
export const studentGroup = pgTable(
    "student_group",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        code: varchar("code", { length: 10 }).notNull().unique(),
        year: yearEnum("year").notNull(),
        mainGroup: smallint("main_group").notNull(),
        subGroup: varchar("sub_group", { length: 2 }),
    },
    (table) => [index("student_group_year").on(table.year)],
);

/**
 * Un cours, dédoublonné entre les groupes qui le suivent.
 * `timestamptz` stocke un instant : la conversion depuis l'heure de Paris est
 * faite au parsing, la relecture est indépendante du fuseau du serveur.
 */
export const lesson = pgTable(
    "lesson",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        dedupKey: varchar("dedup_key", { length: 40 }).notNull().unique(),
        startUtc: timestamp("start_utc", { withTimezone: true }).notNull(),
        endUtc: timestamp("end_utc", { withTimezone: true }).notNull(),
        type: lessonTypeEnum("type").notNull(),
        subjectId: integer("subject_id")
            .notNull()
            .references(() => subject.id),
        teacherId: integer("teacher_id").references(() => teacher.id),
        rawSummary: varchar("raw_summary", { length: 255 }).notNull(),
    },
    (table) => [index("lesson_window").on(table.startUtc, table.endUtc)],
);

/**
 * Salles occupées par un cours. Un cours sans salle (FERIE, `LOCATION:.`)
 * n'a simplement aucune ligne ici et n'occupe donc rien.
 */
export const lessonRoom = pgTable(
    "lesson_room",
    {
        lessonId: integer("lesson_id")
            .notNull()
            .references(() => lesson.id, { onDelete: "cascade" }),
        roomId: integer("room_id")
            .notNull()
            .references(() => room.id, { onDelete: "cascade" }),
    },
    (table) => [
        primaryKey({ columns: [table.lessonId, table.roomId] }),
        index("lesson_room_room").on(table.roomId),
    ],
);

/**
 * Rattachement d'un cours à un groupe, avec le fichier ICS d'origine.
 * `source_id` permet de resynchroniser un fichier mis à jour en ne
 * supprimant que ses propres rattachements.
 */
export const lessonGroup = pgTable(
    "lesson_group",
    {
        lessonId: integer("lesson_id")
            .notNull()
            .references(() => lesson.id, { onDelete: "cascade" }),
        groupId: integer("group_id")
            .notNull()
            .references(() => studentGroup.id, { onDelete: "cascade" }),
        sourceId: integer("source_id")
            .notNull()
            .references(() => icsSource.id, { onDelete: "cascade" }),
    },
    (table) => [
        primaryKey({ columns: [table.lessonId, table.groupId, table.sourceId] }),
        index("lesson_group_group").on(table.groupId),
        index("lesson_group_source").on(table.sourceId),
    ],
);

// ============================================
// Relations
// ============================================

export const lessonRelations = relations(lesson, ({ one, many }) => ({
    subject: one(subject, { fields: [lesson.subjectId], references: [subject.id] }),
    teacher: one(teacher, { fields: [lesson.teacherId], references: [teacher.id] }),
    rooms: many(lessonRoom),
    groups: many(lessonGroup),
}));

export const lessonRoomRelations = relations(lessonRoom, ({ one }) => ({
    lesson: one(lesson, { fields: [lessonRoom.lessonId], references: [lesson.id] }),
    room: one(room, { fields: [lessonRoom.roomId], references: [room.id] }),
}));

export const lessonGroupRelations = relations(lessonGroup, ({ one }) => ({
    lesson: one(lesson, { fields: [lessonGroup.lessonId], references: [lesson.id] }),
    group: one(studentGroup, { fields: [lessonGroup.groupId], references: [studentGroup.id] }),
    source: one(icsSource, { fields: [lessonGroup.sourceId], references: [icsSource.id] }),
}));

export const roomRelations = relations(room, ({ many }) => ({
    lessons: many(lessonRoom),
}));

export const subjectRelations = relations(subject, ({ many }) => ({
    lessons: many(lesson),
}));

export const teacherRelations = relations(teacher, ({ many }) => ({
    lessons: many(lesson),
}));

export const studentGroupRelations = relations(studentGroup, ({ many }) => ({
    lessons: many(lessonGroup),
}));

export const icsSourceRelations = relations(icsSource, ({ many }) => ({
    lessons: many(lessonGroup),
}));
