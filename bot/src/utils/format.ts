// ============================================
// 📁 src/utils/format.ts
// Formatting utilities and group code mappings
// ============================================

/**
 * Mapping for main academic groups and years
 * Negative values = academic years (A1, A2, A3)
 * Positive values = student groups (G1-G8)
 */
export const MAIN_GROUP_CODES: Record<number, string> = {
    [-1]: "A1",
    [-2]: "A2",
    [-3]: "A3",
    1: "G1",
    2: "G2",
    3: "G3",
    4: "G4",
    5: "G5",
    6: "G6",
    7: "G7",
    8: "G8",
};

/**
 * Mapping for sub-groups within main groups
 */
export const SUB_GROUP_CODES: Record<number, string> = {
    [-1]: "",
    1: "A",
    2: "B",
};

/**
 * Format a group code from database values
 */
export function formatGroupCode(mainGroup: number, subGroup: number): string {
    const main = MAIN_GROUP_CODES[mainGroup] ?? `G${mainGroup}`;
    const sub = SUB_GROUP_CODES[subGroup] ?? "";
    return main + sub;
}


/**
 * Pad a number with leading zeros
 */
export function padZero(num: number): string {
    return num < 10 ? `0${num}` : `${num}`;
}
