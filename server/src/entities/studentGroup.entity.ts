// ============================================
// 📁 src/entities/studentGroup.entity.ts
// Groupe d'étudiants
// ============================================

import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { YEARS, type Year } from "./enums.js";
import { LessonGroup } from "./lessonGroup.entity.js";

/**
 * Groupe tel que publié par l'IUT : `G1a` désigne le groupe 1, sous-groupe A.
 *
 * Il n'existe pas de G6, et le G8 n'a qu'un sous-groupe réellement utilisé —
 * le G8B existe côté administratif mais reste vide.
 */
@Entity("student_group")
@Index(["year"])
export class StudentGroup {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 10, unique: true })
    code!: string;

    @Column({ type: "enum", enum: YEARS })
    year!: Year;

    @Column({ name: "main_group", type: "smallint" })
    mainGroup!: number;

    /** `a`, `b`, ou `null` lorsque le cours concerne le groupe entier. */
    @Column({ name: "sub_group", type: "varchar", length: 2, nullable: true })
    subGroup!: string | null;

    @OneToMany(() => LessonGroup, (link) => link.group)
    lessons!: Relation<LessonGroup>[];
}
