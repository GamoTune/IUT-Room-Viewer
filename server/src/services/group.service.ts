// ============================================
// 📁 src/services/group.service.ts
// Logique métier pour les groupes
// ============================================

import groupRepository from "../repository/group.repository.js";
import type { GroupResponse } from "../types/group.types.js";

/**
 * Service pour la logique métier des groupes
 */
export class GroupService {
    public static instance: GroupService = new GroupService();

    /**
     * Liste les groupes tels que publiés par l'IUT, avec leur libellé
     * d'affichage (`G8A`).
     */
    async getAllGroups(): Promise<GroupResponse[]> {
        const groups = await groupRepository.findAll();

        return groups.map((group) => ({
            code: group.code,
            label: `G${group.mainGroup}${(group.subGroup ?? "").toUpperCase()}`,
            year: group.year,
            mainGroup: group.mainGroup,
            subGroup: group.subGroup,
        }));
    }
}
