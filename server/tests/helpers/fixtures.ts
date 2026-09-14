// ============================================
// 📁 tests/helpers/fixtures.ts
// Objets de domaine réduits à ce que les tests consultent
// ============================================

import type { GroupCensus } from "../../src/repository/lesson.repository.js";
import type { Lesson } from "../../src/entities/lesson.entity.js";
import type { StudentGroup } from "../../src/entities/studentGroup.entity.js";

export function studentGroup(code: string, year: string, mainGroup: number, subGroup: string | null): StudentGroup {
    return { id: mainGroup, code, year, mainGroup, subGroup } as StudentGroup;
}

/** Recensement type : trois années de six sous-groupes, groupes dédoublés. */
export const census: GroupCensus = {
    perYear: new Map([
        ["A1", 6],
        ["A2", 6],
        ["A3", 6],
    ]),
    perMainGroup: new Map([
        [1, 2],
        [7, 2],
        [8, 2],
    ]),
};

interface LessonOptions {
    id?: number;
    type?: string;
    start?: string;
    end?: string;
    rooms?: string[];
    teacher?: string | null;
    code?: string;
    label?: string;
    groups?: StudentGroup[];
}

/** Un cours tel que le repository le charge, relations comprises. */
export function lesson(options: LessonOptions = {}): Lesson {
    const {
        id = 1,
        type = "TP",
        start = "2026-09-10T06:00:00.000Z",
        end = "2026-09-10T08:00:00.000Z",
        rooms = ["R52"],
        teacher = "JP",
        code = "R5A.14",
        label = "Anglais",
        groups = [studentGroup("G8a", "A3", 8, "a")],
    } = options;

    return {
        id,
        type,
        startUtc: new Date(start),
        endUtc: new Date(end),
        rooms: rooms.map((name, index) => ({ id: index + 1, name })),
        teacher: teacher === null ? null : { id: 1, name: teacher },
        subject: { id: 1, code, label },
        groups: groups.map((group) => ({ group })),
    } as unknown as Lesson;
}
