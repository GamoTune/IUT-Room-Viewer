// ============================================
// 📁 tests/sync/ics/parser.spec.ts
// ============================================

import { describe, expect, it } from "bun:test";
import { parseIcs, parseIcsDate, unfoldLines } from "../../../src/sync/ics/parser.js";

describe("unfoldLines", () => {
    it("recolle une ligne repliée sur une espace", () => {
        expect(unfoldLines("SUMMARY:déb\n ut")).toEqual(["SUMMARY:début"]);
    });

    it("recolle une ligne repliée sur une tabulation", () => {
        expect(unfoldLines("SUMMARY:déb\n\tut")).toEqual(["SUMMARY:début"]);
    });

    it("normalise les fins de ligne Windows et Mac", () => {
        expect(unfoldLines("A\r\nB\rC")).toEqual(["A", "B", "C"]);
    });

    it("garde une ligne repliée en tête, faute de ligne à prolonger", () => {
        expect(unfoldLines(" orpheline")).toEqual([" orpheline"]);
    });
});

describe("parseIcsDate", () => {
    it("lit une date en heure locale de Paris, l'été", () => {
        expect(parseIcsDate("20260910T080000")?.toISOString()).toBe("2026-09-10T06:00:00.000Z");
    });

    it("lit une date en heure locale de Paris, l'hiver", () => {
        expect(parseIcsDate("20261210T080000")?.toISOString()).toBe("2026-12-10T07:00:00.000Z");
    });

    it("accepte un TZID explicite sur Paris", () => {
        expect(parseIcsDate("20260910T080000", "Europe/Paris")?.toISOString()).toBe("2026-09-10T06:00:00.000Z");
    });

    it("refuse un fuseau inattendu plutôt que de décaler au hasard", () => {
        expect(parseIcsDate("20260910T080000", "America/New_York")).toBeNull();
    });

    it("prend une date suffixée Z telle quelle", () => {
        expect(parseIcsDate("20260910T080000Z")?.toISOString()).toBe("2026-09-10T08:00:00.000Z");
    });

    it("lit une journée entière, sans heure", () => {
        expect(parseIcsDate("20260910")?.toISOString()).toBe("2026-09-09T22:00:00.000Z");
    });

    it("rejette une valeur d'une autre forme", () => {
        expect(parseIcsDate("pas-une-date")).toBeNull();
        expect(parseIcsDate("2026-09-10")).toBeNull();
        expect(parseIcsDate("")).toBeNull();
    });
});

describe("parseIcs", () => {
    /** Assemble un fichier ICS minimal autour de lignes d'événement. */
    const fichier = (...lignes: string[]) => ["BEGIN:VCALENDAR", ...lignes, "END:VCALENDAR"].join("\r\n");

    const événement = (...lignes: string[]) => fichier("BEGIN:VEVENT", ...lignes, "END:VEVENT");

    it("lit un événement complet", () => {
        const events = parseIcs(
            événement(
                "UID:abc-123",
                "DTSTART:20260910T080000",
                "DTEND:20260910T100000",
                "SUMMARY:R5A.14 Anglais JP TD",
                "LOCATION:R52",
            ),
        );

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
            uid: "abc-123",
            start: new Date("2026-09-10T06:00:00.000Z"),
            end: new Date("2026-09-10T08:00:00.000Z"),
            summary: "R5A.14 Anglais JP TD",
            location: "R52",
        });
    });

    it("ignore les DTSTART hors VEVENT", () => {
        // Le bloc VTIMEZONE en contient, qui décrivent les règles d'heure d'été.
        const contenu = fichier(
            "BEGIN:VTIMEZONE",
            "DTSTART:19700329T020000",
            "END:VTIMEZONE",
            "BEGIN:VEVENT",
            "DTSTART:20260910T080000",
            "DTEND:20260910T100000",
            "END:VEVENT",
        );
        expect(parseIcs(contenu)).toHaveLength(1);
    });

    it("écarte un événement sans date", () => {
        expect(parseIcs(événement("SUMMARY:sans date"))).toEqual([]);
        expect(parseIcs(événement("DTSTART:20260910T080000", "SUMMARY:sans fin"))).toEqual([]);
    });

    it("rend un UID nul quand la propriété manque", () => {
        const events = parseIcs(événement("DTSTART:20260910T080000", "DTEND:20260910T100000"));
        expect(events[0]!.uid).toBeNull();
        expect(events[0]!.summary).toBe("");
        expect(events[0]!.location).toBe("");
    });

    it("écarte un événement dont la date est illisible", () => {
        expect(parseIcs(événement("DTSTART:n-importe-quoi", "DTEND:20260910T100000"))).toEqual([]);
    });

    it("décode le quoted-printable quand il est annoncé", () => {
        const events = parseIcs(
            événement("DTSTART:20260910T080000", "DTEND:20260910T100000", "SUMMARY;ENCODING=QUOTED-PRINTABLE:Qualit=E9"),
        );
        expect(events[0]!.summary).toBe("Qualité");
    });

    it("laisse intact un signe égal qui n'encode rien", () => {
        // L'IUT annonce QUOTED-PRINTABLE sur des textes qui ne le sont pas :
        // décoder sans discernement casserait le premier intitulé contenant « = ».
        const events = parseIcs(
            événement("DTSTART:20260910T080000", "DTEND:20260910T100000", "SUMMARY;ENCODING=QUOTED-PRINTABLE:a=b et c=ZZ"),
        );
        expect(events[0]!.summary).toBe("a=b et c=ZZ");
    });

    it("déplie les échappements du format", () => {
        const events = parseIcs(
            événement("DTSTART:20260910T080000", "DTEND:20260910T100000", "SUMMARY:ligne\\nsuite\\, fin\\; et\\\\bar"),
        );
        expect(events[0]!.summary).toBe("ligne suite, fin; et\\bar");
    });

    it("ignore une ligne sans deux-points et une propriété sans nom", () => {
        const events = parseIcs(
            événement("DTSTART:20260910T080000", "DTEND:20260910T100000", "LIGNE-SANS-VALEUR", ":orpheline"),
        );
        expect(events).toHaveLength(1);
    });

    it("ignore un paramètre mal formé sans perdre la propriété", () => {
        const events = parseIcs(événement("DTSTART:20260910T080000", "DTEND:20260910T100000", "SUMMARY;SANSEGAL:texte"));
        expect(events[0]!.summary).toBe("texte");
    });

    it("ignore les propriétés qui ne l'intéressent pas", () => {
        const events = parseIcs(événement("DTSTART:20260910T080000", "DTEND:20260910T100000", "DESCRIPTION:hors sujet"));
        expect(events).toHaveLength(1);
    });

    it("rend une liste vide sur un contenu sans événement", () => {
        expect(parseIcs("")).toEqual([]);
    });
});
