// ============================================
// 📁 src/entities/user.entity.ts
// Utilisateur Discord
// ============================================

import { Column, Entity, OneToMany, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { Request } from "./request.entity.js";

/**
 * Utilisateur ayant lancé au moins une commande du bot.
 * `discordId` est l'identifiant Discord, un entier 64 bits.
 */
@Entity("users")
export class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: "discord_id", type: "bigint", unique: true })
    discordId!: string;

    @Column({ type: "varchar", length: 100, nullable: true })
    name!: string | null;

    @Column({ name: "global_name", type: "varchar", length: 100, nullable: true })
    globalName!: string | null;

    @OneToMany(() => Request, (request) => request.user)
    requests!: Relation<Request>[];
}
