// ============================================
// 📁 src/entities/room.entity.ts
// Salle du département
// ============================================

import { Column, Entity, Index, ManyToMany, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { ROOM_KINDS, type RoomKind } from "./enums.js";
import { Lesson } from "./lesson.entity.js";

/**
 * Référentiel des salles, alimenté par un seed et jamais par la synchronisation :
 * une salle inconnue rencontrée dans un emploi du temps est signalée, pas créée,
 * pour qu'un changement côté IUT reste visible.
 */
@Entity("room")
export class Room {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 20, unique: true })
    name!: string;

    @Column({ type: "smallint" })
    floor!: number;

    @Column({ type: "enum", enum: ROOM_KINDS, default: "salle" })
    kind!: RoomKind;

    /** Ordre d'affichage : étage puis numéro. */
    @Index()
    @Column({ name: "display_order", type: "smallint", default: 0 })
    displayOrder!: number;

    @Column({ name: "is_active", type: "boolean", default: true })
    isActive!: boolean;

    @ManyToMany(() => Lesson, (lesson) => lesson.rooms)
    lessons!: Relation<Lesson>[];
}
