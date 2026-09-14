// ============================================
// 📁 src/entities/lessonGroup.entity.ts
// Rattachement d'un cours à un groupe
// ============================================

import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from "typeorm";
import { EdtSource } from "./edtSource.entity.js";
import { Lesson } from "./lesson.entity.js";
import { StudentGroup } from "./studentGroup.entity.js";

/**
 * Lie un cours au groupe qui le suit, en gardant le fichier d'où vient
 * l'information.
 *
 * Ce n'est pas une simple table de jointure : le `source` permet de
 * resynchroniser un fichier republié en ne supprimant que ses propres
 * rattachements, sans toucher à ceux des autres groupes.
 */
@Entity("lesson_group")
@Index(["group"])
@Index(["source"])
export class LessonGroup {
    @PrimaryColumn({ name: "lesson_id", type: "int" })
    lessonId!: number;

    @PrimaryColumn({ name: "group_id", type: "int" })
    groupId!: number;

    @PrimaryColumn({ name: "source_id", type: "int" })
    sourceId!: number;

    @ManyToOne(() => Lesson, (lesson) => lesson.groups, { onDelete: "CASCADE" })
    @JoinColumn({ name: "lesson_id" })
    lesson!: Relation<Lesson>;

    @ManyToOne(() => StudentGroup, (group) => group.lessons, { onDelete: "CASCADE" })
    @JoinColumn({ name: "group_id" })
    group!: Relation<StudentGroup>;

    @ManyToOne(() => EdtSource, (source) => source.lessons, { onDelete: "CASCADE" })
    @JoinColumn({ name: "source_id" })
    source!: Relation<EdtSource>;
}
