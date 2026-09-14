// ============================================
// 📁 src/services/source.service.ts
// Documents publiés par l'IUT pour un groupe et une semaine
// ============================================

import groupRepository from "../repository/group.repository.js";
import sourceRepository from "../repository/source.repository.js";
import { SOURCE_FORMATS } from "../entities/enums.js";
import type { SourceFileResponse, SourceLevel, WeekSourcesResponse } from "../types/source.types.js";

/** Du plus précis au plus large : l'ordre dans lequel on consulte son emploi du temps. */
const LEVELS: SourceLevel[] = ["subGroup", "group", "year"];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export class SourceService {
    public static instance: SourceService = new SourceService();

    /**
     * Les documents de la semaine qui commence à `from`, pour un groupe.
     *
     * `null` quand le groupe est inconnu. Une semaine sans document rend quand
     * même ses six emplacements, tous vides : l'écran reste le même.
     */
    async getWeekSources(groupCode: string, from: Date): Promise<WeekSourcesResponse | null> {
        const group = await groupRepository.findByCode(groupCode);
        if (!group) return null;

        const scopes: Record<SourceLevel, string | null> = {
            subGroup: group.subGroup ? `G${group.mainGroup}${group.subGroup}` : null,
            group: `G${group.mainGroup}`,
            year: group.year,
        };

        const weekNumber = await sourceRepository.findWeekNumber(group.year, from, new Date(from.getTime() + WEEK_MS));

        const known = scopes.subGroup ? [scopes.subGroup, scopes.group!, scopes.year!] : [scopes.group!, scopes.year!];
        const found = weekNumber === null ? [] : await sourceRepository.findFiles(weekNumber, known);

        const files: SourceFileResponse[] = LEVELS.flatMap((level) =>
            SOURCE_FORMATS.map((format) => {
                const scope = scopes[level];
                const source = scope ? found.find((file) => file.scope === scope && file.format === format) : undefined;
                return { level, scope, format, url: source?.url ?? null };
            }),
        );

        return { weekNumber, files };
    }
}
