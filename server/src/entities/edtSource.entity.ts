// ============================================
// 📁 src/entities/edtSource.entity.ts
// Fichier d'emploi du temps publié par l'IUT
// ============================================

import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn, Unique, type Relation } from "typeorm";
import { SOURCE_FORMATS, YEARS, type SourceFormat, type Year } from "./enums.js";
import { LessonGroup } from "./lessonGroup.entity.js";

/**
 * Un fichier distant suivi par la synchronisation.
 *
 * `etag` et `lastModified` servent aux requêtes conditionnelles : tant que le
 * serveur répond 304, il n'y a rien à re-lire. Les fichiers `ics` sont suivis
 * et archivés sans être importés — ils proviennent du système de réservation de
 * salles de l'université et sont incomplets.
 */
@Entity("edt_source")
@Unique("edt_source_unique", ["scope", "weekNumber", "format"])
@Index(["year"])
export class EdtSource {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "enum", enum: YEARS })
    year!: Year;

    /** Dossier d'origine : une année (`A1`) ou un sous-groupe (`G1a`). */
    @Column({ type: "varchar", length: 10 })
    scope!: string;

    /** Semaine depuis la rentrée, telle que numérotée par l'IUT. */
    @Column({ name: "week_number", type: "smallint" })
    weekNumber!: number;

    @Column({ type: "enum", enum: SOURCE_FORMATS })
    format!: SourceFormat;

    @Column({ type: "text" })
    url!: string;

    @Column({ type: "varchar", length: 128, nullable: true })
    etag!: string | null;

    @Column({ name: "last_modified", type: "varchar", length: 64, nullable: true })
    lastModified!: string | null;

    @Column({ name: "content_hash", type: "varchar", length: 40, nullable: true })
    contentHash!: string | null;

    @Column({ name: "backup_path", type: "text", nullable: true })
    backupPath!: string | null;

    @Column({ name: "fetched_at", type: "timestamptz", nullable: true })
    fetchedAt!: Date | null;

    @Column({ name: "imported_at", type: "timestamptz", nullable: true })
    importedAt!: Date | null;

    @OneToMany(() => LessonGroup, (link) => link.source)
    lessons!: Relation<LessonGroup>[];
}
