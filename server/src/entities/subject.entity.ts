// ============================================
// 📁 src/entities/subject.entity.ts
// Matière
// ============================================

import { Column, Entity, OneToMany, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { Lesson } from "./lesson.entity.js";

/**
 * Matière ou module : `R1.01`, `S3.01A`, mais aussi les mentions
 * administratives que l'IUT place dans la grille (`FERIE`, `SCO`).
 */
@Entity("subject")
export class Subject {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 20, unique: true })
    code!: string;

    @Column({ type: "varchar", length: 150 })
    label!: string;

    @OneToMany(() => Lesson, (lesson) => lesson.subject)
    lessons!: Relation<Lesson>[];
}
