// ============================================
// 📁 tests/sync/rooms.spec.ts
// ============================================

import { describe, expect, it } from "bun:test";
import { NO_ROOM, expandRoomRange, normalizeRoomName, parseLocation } from "../../src/sync/rooms.js";

describe("normalizeRoomName", () => {
    it("développe les abréviations d'amphithéâtre", () => {
        expect(normalizeRoomName("AC")).toBe("AmphC");
        expect(normalizeRoomName("AmpB")).toBe("AmphB");
        expect(normalizeRoomName("AmphB")).toBe("AmphB");
    });

    it("met la lettre d'amphithéâtre en majuscule", () => {
        expect(normalizeRoomName("ac")).toBe("AmphC");
    });

    it("laisse une salle ordinaire intacte", () => {
        expect(normalizeRoomName("R52")).toBe("R52");
        expect(normalizeRoomName("103")).toBe("103");
    });

    it("retire les espaces autour", () => {
        expect(normalizeRoomName("  R52  ")).toBe("R52");
    });

    it("rend une chaîne vide pour une entrée vide", () => {
        expect(normalizeRoomName("   ")).toBe("");
    });
});

describe("expandRoomRange", () => {
    it("développe le suffixe sur la fin du premier nom", () => {
        expect(expandRoomRange("108-9")).toEqual(["108", "109"]);
        expect(expandRoomRange("111-2")).toEqual(["111", "112"]);
    });

    it("laisse intacte une notation sans tiret", () => {
        expect(expandRoomRange("R52")).toEqual(["R52"]);
    });

    it("refuse un suffixe aussi long que la base", () => {
        // `108-109` n'est pas une abréviation : le développer donnerait « 109 » seul.
        expect(expandRoomRange("108-109")).toEqual(["108-109"]);
    });

    it("refuse une base ou un suffixe vide", () => {
        expect(expandRoomRange("-9")).toEqual(["-9"]);
        expect(expandRoomRange("108-")).toEqual(["108-"]);
    });
});

describe("parseLocation", () => {
    it("reconnaît une salle du référentiel", () => {
        expect(parseLocation("R52")).toEqual({ roomNames: ["R52"], unknownRooms: [] });
    });

    it("développe une paire de salles", () => {
        expect(parseLocation("108-9")).toEqual({ roomNames: ["108", "109"], unknownRooms: [] });
    });

    it("traite le point comme une absence de salle", () => {
        expect(parseLocation(NO_ROOM)).toEqual({ roomNames: [], unknownRooms: [] });
    });

    it("traite une chaîne vide comme une absence de salle", () => {
        expect(parseLocation("   ")).toEqual({ roomNames: [], unknownRooms: [] });
    });

    it("signale une salle hors référentiel au lieu de l'inventer", () => {
        const { roomNames, unknownRooms } = parseLocation("Z99");
        expect(roomNames).toEqual([]);
        expect(unknownRooms).toEqual(["Z99"]);
    });

    it("ne répète pas une salle citée deux fois", () => {
        expect(parseLocation("R52-2").roomNames).toEqual(["R52"]);
    });

    it("ne répète pas une salle inconnue citée deux fois", () => {
        expect(parseLocation("Z99-9").unknownRooms).toEqual(["Z99"]);
    });

    it("ignore un fragment vide issu du développement", () => {
        // « R52- » n'est pas développé ; le nom est conservé tel quel et reste inconnu.
        expect(parseLocation("R52-").unknownRooms).toEqual(["R52-"]);
    });
});
