// ============================================
// 📁 src/entities/lesson.entity.ts
// Cours
// ============================================

import {
    Column,
    Entity,
    Index,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    type Relation,
} from "typeorm";
import { LESSON_TYPES, type LessonType } from "./enums.js";
import { LessonGroup } from "./lessonGroup.entity.js";
import { Room } from "./room.entity.js";
import { Subject } from "./subject.entity.js";
import { Teacher } from "./teacher.entity.js";

/**
 * Un cours, stocké une seule fois quel que soit le nombre de groupes qui le
 * suivent : un CM de promo apparaît dans l'emploi du temps de chaque groupe,
 * mais n'occupe qu'une fois sa salle.
 *
 * Les dates sont des instants (`timestamptz`) : la conversion depuis l'heure de
 * Paris est faite à la lecture du document.
 */
@Entity("lesson")
@Index(["startUtc", "endUtc"])
export class Lesson {
    @PrimaryGeneratedColumn()
    id!: number;

    /**
     * Empreinte du cours, indépendante du fichier qui le publie.
     * C'est la clé du dédoublonnage entre groupes.
     */
    @Column({ name: "dedup_key", type: "varchar", length: 40, unique: true })
    dedupKey!: string;

    @Column({ name: "start_utc", type: "timestamptz" })
    startUtc!: Date;

    @Column({ name: "end_utc", type: "timestamptz" })
    endUtc!: Date;

    @Column({ type: "enum", enum: LESSON_TYPES })
    type!: LessonType;

    @ManyToOne(() => Subject, (subject) => subject.lessons, { nullable: false })
    @JoinColumn({ name: "subject_id" })
    subject!: Relation<Subject>;

    @ManyToOne(() => Teacher, (teacher) => teacher.lessons, { nullable: true })
    @JoinColumn({ name: "teacher_id" })
    teacher!: Relation<Teacher> | null;

    /** Contenu brut de la case, conservé pour pouvoir diagnostiquer une lecture douteuse. */
    @Column({ name: "raw_content", type: "varchar", length: 255 })
    rawContent!: string;

    /**
     * Salles occupées. Un cours sans salle — jour férié, mention administrative —
     * n'a simplement aucune salle et n'occupe donc rien.
     */
    @ManyToMany(() => Room, (room) => room.lessons)
    @JoinTable({
        name: "lesson_room",
        joinColumn: { name: "lesson_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "room_id", referencedColumnName: "id" },
    })
    rooms!: Relation<Room>[];

    @OneToMany(() => LessonGroup, (link) => link.lesson)
    groups!: Relation<LessonGroup>[];
}
