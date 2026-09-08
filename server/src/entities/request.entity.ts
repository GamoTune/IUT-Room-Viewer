// ============================================
// 📁 src/entities/request.entity.ts
// Commande exécutée
// ============================================

import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    type Relation,
} from "typeorm";
import { User } from "./user.entity.js";

/** Une commande du bot, conservée pour les statistiques d'usage. */
@Entity("requests")
@Index(["user"])
export class Request {
    @PrimaryGeneratedColumn()
    id!: number;

    @CreateDateColumn({ name: "request_date", type: "timestamptz" })
    requestDate!: Date;

    @Column({ name: "request_text", type: "text" })
    requestText!: string;

    @ManyToOne(() => User, (user) => user.requests, { onDelete: "CASCADE", nullable: false })
    @JoinColumn({ name: "user_id" })
    user!: Relation<User>;
}
