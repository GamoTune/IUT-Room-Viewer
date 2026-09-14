// ============================================
// 📁 src/entities/teacher.entity.ts
// Enseignant
// ============================================

import { Column, Entity, OneToMany, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { Lesson } from "./lesson.entity.js";

/**
 * Enseignant, enregistré tel qu'il apparaît dans la source.
 *
 * Les documents de l'IUT désignent le même enseignant tantôt par un nom
 * (`Onete C.`), tantôt par un code (`CO`), sans correspondance fiable entre les
 * deux. Aucun rapprochement n'est tenté : chaque forme rencontrée devient une
 * entrée, créée automatiquement. Une recherche peut porter sur plusieurs formes
 * et en réunir les résultats.
 */
@Entity("teacher")
export class Teacher {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 100, unique: true })
    name!: string;

    @OneToMany(() => Lesson, (lesson) => lesson.teacher)
    lessons!: Relation<Lesson>[];
}
