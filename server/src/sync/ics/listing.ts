// ============================================
// 📁 src/sync/ics/listing.ts
// Découverte des fichiers publiés par l'IUT
// ============================================

import { YEARS, type Year } from "../../db/schema.js";
import type { IcsFileEntry } from "./types.js";

/**
 * Racine du listing Apache des emplois du temps.
 */
export const EDT_BASE_URL = process.env.EDT_BASE_URL ?? "https://edt-iut-info.unilim.fr/edt/";

/**
 * Un fichier PDF, conservé uniquement pour l'archivage.
 */
export interface PdfFileEntry {
    year: Year;
    /** Dossier d'origine : un groupe (`G1a`) ou l'année elle-même. */
    scope: string;
    fileName: string;
    url: string;
}

export interface Discovery {
    icsFiles: IcsFileEntry[];
    pdfFiles: PdfFileEntry[];
}

/**
 * Extrait les liens d'un index de répertoire Apache, en ignorant les liens
 * de tri (`?C=N;O=D`) et le lien vers le dossier parent.
 */
export function parseDirectoryListing(html: string): string[] {
    const hrefs: string[] = [];
    const pattern = /href="([^"]+)"/gi;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
        const href = match[1]!;
        if (href.startsWith("?") || href.startsWith("/") || href.startsWith("..")) continue;
        if (!hrefs.includes(href)) hrefs.push(href);
    }

    return hrefs;
}

async function fetchListing(url: string): Promise<string[]> {
    const response = await fetch(url, { headers: { Accept: "text/html" } });
    if (!response.ok) {
        throw new Error(`Listing ${url} : HTTP ${response.status}`);
    }
    return parseDirectoryListing(await response.text());
}

/**
 * Numéro de semaine porté par un nom de fichier (`G1a_S3.ics` → 3).
 *
 * Le `S` désigne bien la semaine depuis la rentrée, pas le semestre :
 * `G1a_S1.ics` couvre le 31/08 → 04/09, `G1a_S2.ics` le 07/09 → 11/09.
 */
export function extractWeekNumber(fileName: string): number | null {
    const match = fileName.match(/_S(\d+)\.(?:ics|pdf)$/i);
    return match ? Number(match[1]) : null;
}

function joinUrl(base: string, segment: string): string {
    return new URL(segment, base.endsWith("/") ? base : `${base}/`).toString();
}

/**
 * Parcourt le listing distant pour trouver tous les fichiers disponibles.
 *
 * Les noms ne sont jamais devinés : les semaines apparaissent au fil de
 * l'année, et seuls les sous-groupes (`G1a`, `G4b`...) publient des ICS —
 * les groupes entiers et les promos n'ont que des PDF.
 */
export async function discoverFiles(baseUrl: string = EDT_BASE_URL): Promise<Discovery> {
    const icsFiles: IcsFileEntry[] = [];
    const pdfFiles: PdfFileEntry[] = [];

    const yearDirs = await fetchListing(baseUrl);

    for (const yearDir of yearDirs) {
        if (!yearDir.endsWith("/")) continue;

        const year = yearDir.replace(/\/$/, "") as Year;
        if (!YEARS.includes(year)) continue;

        const yearUrl = joinUrl(baseUrl, yearDir);
        const entries = await fetchListing(yearUrl);

        for (const entry of entries) {
            // PDF de promo, au niveau de l'année
            if (entry.toLowerCase().endsWith(".pdf")) {
                pdfFiles.push({ year, scope: year, fileName: entry, url: joinUrl(yearUrl, entry) });
                continue;
            }

            if (!entry.endsWith("/")) continue;

            const groupCode = entry.replace(/\/$/, "");
            const groupUrl = joinUrl(yearUrl, entry);
            const files = await fetchListing(groupUrl);

            for (const file of files) {
                const lower = file.toLowerCase();

                if (lower.endsWith(".pdf")) {
                    pdfFiles.push({ year, scope: groupCode, fileName: file, url: joinUrl(groupUrl, file) });
                    continue;
                }

                if (!lower.endsWith(".ics")) continue;

                const weekNumber = extractWeekNumber(file);
                if (weekNumber === null) {
                    console.warn(`⚠️  Semaine illisible dans le nom de fichier : ${file}`);
                    continue;
                }

                icsFiles.push({
                    year,
                    groupCode,
                    weekNumber,
                    fileName: file,
                    url: joinUrl(groupUrl, file),
                });
            }
        }
    }

    icsFiles.sort(
        (a, b) =>
            a.year.localeCompare(b.year) ||
            a.weekNumber - b.weekNumber ||
            a.groupCode.localeCompare(b.groupCode),
    );

    return { icsFiles, pdfFiles };
}

/**
 * Décompose un code de groupe : `G1a` → groupe 1, sous-groupe `a`.
 */
export function parseGroupCode(groupCode: string): { mainGroup: number; subGroup: string | null } | null {
    const match = groupCode.match(/^G(\d+)([a-z])?$/i);
    if (!match) return null;

    return {
        mainGroup: Number(match[1]),
        subGroup: match[2]?.toLowerCase() ?? null,
    };
}
