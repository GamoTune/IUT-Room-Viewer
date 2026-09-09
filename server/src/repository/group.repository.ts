// ============================================
// 📁 src/repository/group.repository.ts
// Accès aux groupes d'étudiants
// ============================================

import dataSource from "../utils/dataSource.js";
import { StudentGroup } from "../entities/studentGroup.entity.js";

/**
 * Repository des groupes.
 */
export class GroupRepository {
    public static instance: GroupRepository = new GroupRepository();

    /**
     * Tous les groupes connus, dans l'ordre d'affichage : par année, puis par
     * numéro de groupe, puis par sous-groupe.
     */
    async findAll(): Promise<StudentGroup[]> {
        return dataSource.getRepository(StudentGroup).find({
            order: { year: "ASC", mainGroup: "ASC", subGroup: "ASC" },
        });
    }
}

export default GroupRepository.instance;
