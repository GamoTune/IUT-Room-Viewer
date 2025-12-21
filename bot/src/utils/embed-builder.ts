// ============================================
// 📁 src/utils/embed-builder.ts
// Discord embed field creation utilities
// ============================================

import { EmbedBuilder } from "discord.js";
import type { RoomWithLessonsResponse, LessonResponse } from "../types/index.js";
import { formatGroupCode } from "./format.js";

// Salles physiquement identiques : fusionner leurs cours pour l'affichage
// Si R46 ou R47 est occupée, les deux sont occupées
const ROOM_ALIASES: Record<string, string[]> = {
    "R46": ["R46", "R47"],
    "R47": ["R46", "R47"],
};

/**
 * Fusionne les lessons des salles liées (ex: R46 et R47 sont la même salle)
 * Chaque salle du groupe affichera les mêmes lessons
 */
function mergeLinkedRooms(rooms: RoomWithLessonsResponse[]): RoomWithLessonsResponse[] {
    const roomMap = new Map<string, RoomWithLessonsResponse>();

    // Indexer les salles par nom
    for (const room of rooms) {
        roomMap.set(room.name, room);
    }

    // Pour chaque groupe d'aliases, fusionner les lessons
    const processedGroups = new Set<string>();

    for (const room of rooms) {
        const aliases = ROOM_ALIASES[room.name];
        if (!aliases) continue;

        // Créer une clé unique pour ce groupe d'aliases
        const groupKey = aliases.sort().join(",");
        if (processedGroups.has(groupKey)) continue;
        processedGroups.add(groupKey);

        // Collecter toutes les lessons uniques de ce groupe
        const allLessons = new Map<number, LessonResponse>();
        for (const aliasName of aliases) {
            const aliasRoom = roomMap.get(aliasName);
            if (aliasRoom) {
                for (const lesson of aliasRoom.lessons) {
                    allLessons.set(lesson.id, lesson);
                }
            }
        }

        // Appliquer les lessons fusionnées à toutes les salles du groupe
        const mergedLessons = Array.from(allLessons.values());
        for (const aliasName of aliases) {
            const aliasRoom = roomMap.get(aliasName);
            if (aliasRoom) {
                aliasRoom.lessons = mergedLessons;
            }
        }
    }

    return rooms;
}

/**
 * Format a single room's status for display
 */
function formatRoomStatus(room: RoomWithLessonsResponse): string {
    const { name, lessons } = room;

    // Room is available
    if (lessons.length === 0) {
        return `\`${name} ✅ - Disponible\``;
    }

    // Room has multiple lessons
    if (lessons.length > 1) {
        return `\`${name} ❌ - Occupée\``;
    }

    // Single lesson - show details
    const lesson = lessons[0];
    const group = lesson.groups[0]
        ? formatGroupCode(lesson.groups[0].mainGroup, lesson.groups[0].subGroup)
        : "";
    const teacher = lesson.teacher ?? "?";

    return `\`${name} ❌ - ${lesson.contentCode} (${teacher}) (${group})\``;
}

/**
 * Create Discord embed fields organized by building floor
 */
export function createRoomFields(rooms: RoomWithLessonsResponse[]): Array<{
    name: string;
    value: string;
    inline: boolean;
}> {
    // Fusionner les salles liées avant l'affichage
    const mergedRooms = mergeLinkedRooms(rooms);

    // Initialize arrays for each floor
    const RDC: string[] = [];
    const E1: string[] = [];
    const E2: string[] = [];
    const Amph: string[] = [];

    // Categorize rooms by floor
    for (const room of mergedRooms) {
        const formatted = formatRoomStatus(room);
        const name = room.name;

        if (name.startsWith("R")) {
            RDC.push(formatted);
        } else if (name.startsWith("1")) {
            E1.push(formatted);
        } else if (name.startsWith("2")) {
            E2.push(formatted);
        } else if (name.startsWith("A")) {
            Amph.push(formatted);
        }
    }

    return [
        { name: "RDC", value: RDC.join("\n") || "Aucune salle", inline: true },
        { name: "1er étage", value: E1.join("\n") || "Aucune salle", inline: true },
        { name: "\u200B", value: "\u200B", inline: true },
        { name: "2ème étage", value: E2.join("\n") || "Aucune salle", inline: true },
        { name: "Amphithéâtres", value: Amph.join("\n") || "Aucun", inline: true },
        { name: "\u200B", value: "\u200B", inline: true },
    ];
}

/**
 * Create a room availability embed
 */
export function createRoomAvailabilityEmbed(
    rooms: RoomWithLessonsResponse[],
    description: string
): EmbedBuilder {
    const fields = createRoomFields(rooms);

    return new EmbedBuilder()
        .setColor("#a66949")
        .setTitle("Informations salles")
        .setDescription(description)
        .addFields(fields)
        .setFooter({ text: "✅ : Disponible  |  ❌ : Occupée" });
}

