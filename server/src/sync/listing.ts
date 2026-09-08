// ============================================
// 📁 src/sync/listing.ts
// Découverte des fichiers publiés par l'IUT
// ============================================

import { YEARS, type SourceFormat, type Year } from "../entities/enums.js";
import type { SourceFile } from "./types.js";

/** Racine du listing des emplois du temps. */
export const EDT_BASE_URL = process.env.EDT_BASE_URL ?? "https://edt-iut-info.unilim.fr/edt/";

/**
 * Extrait les liens d'un index de répertoire Apache, en ignorant les liens de
 * tri (`?C=N;O=D`) et le lien vers le dossier parent.
 */
export function parseDirectoryListing(html: string): string[] {
    const hrefs: string[] = [];
    const pattern = /href="([^"]+)"/gi;

    let matched: RegExpExecArray | null;
    while ((matched = pattern.exec(html)) !== null) {
        const href = matched[1]!;
        if (href.startsWith("?") || href.startsWith("/") || href.startsWith("..")) continue;
        if (!hrefs.includes(href)) hrefs.push(href);
    }

    return hrefs;
}

/**
 * Numéro de semaine porté par un nom de fichier (`A1_S3.pdf` → 3).
 *
 * Le `S` désigne la semaine depuis la rentrée, pas le semestre.
 */
export function extractWeekNumber(fileName: string): number | null {
    const matched = fileName.match(/_S(\d+)\.(?:pdf|ics)$/i);
    return matched ? Number(matched[1]) : null;
}

function joinUrl(base: string, segment: string): string {
    return new URL(segment, base.endsWith("/") ? base : `${base}/`).toString();
}

async function fetchListing(url: string): Promise<string[]> {
    const response = await fetch(url, { headers: { Accept: "text/html" } });
    if (!response.ok) throw new Error(`Listing ${url} : HTTP ${response.status}`);
    return parseDirectoryListing(await response.text());
}

function toSourceFile(year: Year, scope: string, fileName: string, url: string): SourceFile | null {
    const weekNumber = extractWeekNumber(fileName);
    if (weekNumber === null) {
        console.warn(`⚠️  Semaine illisible dans le nom de fichier : ${fileName}`);
        return null;
    }

    const format: SourceFormat = fileName.toLowerCase().endsWith(".pdf") ? "pdf" : "ics";
    return { year, scope, weekNumber, format, fileName, url };
}

/**
 * Parcourt le listing distant pour trouver tous les fichiers disponibles.
 *
 * Les noms ne sont jamais devinés : les semaines apparaissent au fil de l'année.
 * Les fichiers d'année (`A1_S1.pdf`) sont la source qui fait foi ; ceux des
 * groupes et sous-groupes sont découverts aussi, pour l'archivage et les
 * recoupements.
 */
export async function discoverFiles(baseUrl: string = EDT_BASE_URL): Promise<SourceFile[]> {
    const files: SourceFile[] = [];
    const yearDirs = await fetchListing(baseUrl);

    for (const yearDir of yearDirs) {
        if (!yearDir.endsWith("/")) continue;

        const year = yearDir.replace(/\/$/, "") as Year;
        if (!YEARS.includes(year)) continue;

        const yearUrl = joinUrl(baseUrl, yearDir);

        for (const entry of await fetchListing(yearUrl)) {
            // Fichiers de promotion, au niveau de l'année
            if (/\.(pdf|ics)$/i.test(entry)) {
                const file = toSourceFile(year, year, entry, joinUrl(yearUrl, entry));
                if (file) files.push(file);
                continue;
            }

            if (!entry.endsWith("/")) continue;

            const scope = entry.replace(/\/$/, "");
            const groupUrl = joinUrl(yearUrl, entry);

            for (const fileName of await fetchListing(groupUrl)) {
                if (!/\.(pdf|ics)$/i.test(fileName)) continue;
                const file = toSourceFile(year, scope, fileName, joinUrl(groupUrl, fileName));
                if (file) files.push(file);
            }
        }
    }

    files.sort(
        (a, b) =>
            a.year.localeCompare(b.year) ||
            a.weekNumber - b.weekNumber ||
            a.scope.localeCompare(b.scope) ||
            a.format.localeCompare(b.format),
    );

    return files;
}

/** Un fichier est-il l'emploi du temps d'une promotion entière ? */
export function isYearFile(file: SourceFile): boolean {
    return file.scope === file.year;
}
