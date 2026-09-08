// ============================================
// 📁 src/sync/ics/parser.ts
// Lecture des fichiers ICS publiés par l'IUT
// ============================================

import type { RawIcsEvent } from "./types.js";

/**
 * Les fichiers de l'IUT annoncent `ENCODING=QUOTED-PRINTABLE` sur SUMMARY et
 * LOCATION alors que le texte n'est pas encodé ainsi. Un décodage systématique
 * casserait le premier intitulé contenant un `=`. On ne décode donc que les
 * séquences qui ressemblent vraiment à du quoted-printable.
 */
const QUOTED_PRINTABLE_SEQUENCE = /=([0-9A-F]{2})/g;

/**
 * Déplie les lignes ICS : une ligne trop longue est coupée et sa suite
 * commence par une espace ou une tabulation (RFC 5545, section 3.1).
 * Absent des fichiers actuels, mais le format l'autorise à tout moment.
 */
export function unfoldLines(content: string): string[] {
    const rawLines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const lines: string[] = [];

    for (const rawLine of rawLines) {
        if ((rawLine.startsWith(" ") || rawLine.startsWith("\t")) && lines.length > 0) {
            lines[lines.length - 1] += rawLine.slice(1);
            continue;
        }
        lines.push(rawLine);
    }

    return lines;
}

interface IcsProperty {
    name: string;
    params: Record<string, string>;
    value: string;
}

/**
 * Découpe une ligne `NOM;PARAM=VALEUR:contenu`.
 */
function parseProperty(line: string): IcsProperty | null {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) return null;

    const head = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);

    const [name, ...paramParts] = head.split(";");
    if (!name) return null;

    const params: Record<string, string> = {};
    for (const part of paramParts) {
        const equalIndex = part.indexOf("=");
        if (equalIndex === -1) continue;
        params[part.slice(0, equalIndex).toUpperCase()] = part.slice(equalIndex + 1);
    }

    return { name: name.toUpperCase(), params, value };
}

/**
 * Décode prudemment une valeur annoncée en quoted-printable.
 */
function decodeValue(property: IcsProperty): string {
    const encoding = property.params.ENCODING?.toUpperCase();
    let value = property.value;

    if (encoding === "QUOTED-PRINTABLE") {
        value = value
            .replace(/=\n/g, "")
            .replace(QUOTED_PRINTABLE_SEQUENCE, (match, hex: string) => {
                const byte = Number.parseInt(hex, 16);
                return Number.isNaN(byte) ? match : String.fromCharCode(byte);
            });
    }

    // Échappements standard du format ICS
    return value
        .replace(/\\n/gi, " ")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\")
        .trim();
}

/**
 * Décalage UTC de l'Europe/Paris à un instant donné, en minutes.
 * Calculé via l'Intl du runtime plutôt qu'en codant en dur les règles d'été.
 */
function parisOffsetMinutes(utcGuess: Date): number {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Paris",
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

    const parts = formatter.formatToParts(utcGuess);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");

    const asUtc = Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour") === 24 ? 0 : get("hour"),
        get("minute"),
        get("second"),
    );

    return (asUtc - utcGuess.getTime()) / 60000;
}

/**
 * Convertit une date ICS en instant UTC.
 *
 * Formats gérés : `20260903T100000` (heure locale + TZID), `20260903T080000Z`
 * (déjà en UTC) et `20260903` (journée entière).
 */
export function parseIcsDate(value: string, tzid?: string): Date | null {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
    if (!match) return null;

    const [, year, month, day, hour = "00", minute = "00", second = "00", zulu] = match;

    const naiveUtc = Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
    );

    if (zulu) return new Date(naiveUtc);

    // Sans TZID explicite, l'IUT publie en heure locale de Paris.
    if (tzid && tzid !== "Europe/Paris") {
        // Fuseau inattendu : on refuse plutôt que de décaler silencieusement.
        return null;
    }

    // Deux passes : le décalage dépend de l'instant, qu'on ne connaît qu'après l'avoir appliqué.
    let offset = parisOffsetMinutes(new Date(naiveUtc));
    let instant = naiveUtc - offset * 60000;
    offset = parisOffsetMinutes(new Date(instant));
    instant = naiveUtc - offset * 60000;

    return new Date(instant);
}

/**
 * Extrait les VEVENT d'un fichier ICS.
 *
 * Seul l'intérieur des blocs VEVENT est lu : l'en-tête VTIMEZONE contient lui
 * aussi des DTSTART (`19700329T020000`, règles de changement d'heure) qui n'ont
 * rien à voir avec des cours.
 */
export function parseIcs(content: string): RawIcsEvent[] {
    const lines = unfoldLines(content);
    const events: RawIcsEvent[] = [];

    let current: Partial<RawIcsEvent> | null = null;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === "BEGIN:VEVENT") {
            current = { uid: null, summary: "", location: "" };
            continue;
        }

        if (trimmed === "END:VEVENT") {
            if (current?.start && current.end) {
                events.push({
                    uid: current.uid ?? null,
                    start: current.start,
                    end: current.end,
                    summary: current.summary ?? "",
                    location: current.location ?? "",
                });
            }
            current = null;
            continue;
        }

        if (!current) continue;

        const property = parseProperty(trimmed);
        if (!property) continue;

        switch (property.name) {
            case "UID":
                current.uid = decodeValue(property);
                break;
            case "DTSTART":
                current.start = parseIcsDate(property.value.trim(), property.params.TZID) ?? undefined;
                break;
            case "DTEND":
                current.end = parseIcsDate(property.value.trim(), property.params.TZID) ?? undefined;
                break;
            case "SUMMARY":
                current.summary = decodeValue(property);
                break;
            case "LOCATION":
                current.location = decodeValue(property);
                break;
            default:
                break;
        }
    }

    return events;
}
