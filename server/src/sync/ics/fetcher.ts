// ============================================
// 📁 src/sync/ics/fetcher.ts
// Téléchargement conditionnel et archivage des fichiers
// ============================================

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FetchOutcome } from "./types.js";

/**
 * Racine des archives. Chaque version téléchargée y est conservée : les EDT
 * sont republiés en cours d'année et l'historique permet de comprendre après
 * coup ce qui a changé.
 */
export const BACKUP_ROOT =
    process.env.EDT_BACKUP_DIR ?? path.resolve(process.cwd(), "data", "backup");

export interface ConditionalHeaders {
    etag?: string | null;
    lastModified?: string | null;
}

/**
 * Horodatage utilisable dans un nom de fichier : `2026-08-28T07-04-01Z`.
 */
function fileStamp(value: string | null): string {
    const date = value ? new Date(value) : new Date();
    const safe = Number.isNaN(date.getTime()) ? new Date() : date;
    return safe.toISOString().replace(/:/g, "-").replace(/\.\d{3}/, "");
}

/**
 * Écrit une version dans les archives sans jamais écraser une version
 * antérieure : le nom porte la date de publication du fichier.
 */
export async function archiveFile(
    relativeDir: string,
    fileName: string,
    lastModified: string | null,
    content: Uint8Array | string,
): Promise<string> {
    const directory = path.join(BACKUP_ROOT, relativeDir);
    await mkdir(directory, { recursive: true });

    const extension = path.extname(fileName);
    const base = path.basename(fileName, extension);
    const target = path.join(directory, `${base}__${fileStamp(lastModified)}${extension}`);

    await writeFile(target, content);
    return target;
}

/**
 * Récupère un fichier ICS en requête conditionnelle.
 *
 * Le serveur de l'IUT expose `ETag` et `Last-Modified` : tant qu'il répond
 * 304, le contenu est identique et il n'y a rien à re-parser.
 */
export async function fetchIcs(
    url: string,
    relativeDir: string,
    fileName: string,
    previous: ConditionalHeaders = {},
): Promise<FetchOutcome> {
    const headers: Record<string, string> = { Accept: "text/calendar" };
    if (previous.etag) headers["If-None-Match"] = previous.etag;
    if (previous.lastModified) headers["If-Modified-Since"] = previous.lastModified;

    const response = await fetch(url, { headers });

    if (response.status === 304) {
        return { status: "unchanged" };
    }

    if (!response.ok) {
        throw new Error(`Téléchargement ${url} : HTTP ${response.status}`);
    }

    const content = await response.text();
    const contentHash = createHash("sha1").update(content).digest("hex");
    const etag = response.headers.get("etag");
    const lastModified = response.headers.get("last-modified");

    // Certains serveurs renvoient 200 malgré un contenu identique.
    if (previous.etag && etag === previous.etag) {
        return { status: "unchanged" };
    }

    const backupPath = await archiveFile(relativeDir, fileName, lastModified, content);

    return { status: "downloaded", content, etag, lastModified, contentHash, backupPath };
}

/**
 * Archive un PDF. Ils ne sont plus analysés depuis le passage à l'ICS, mais
 * restent la seule vue officielle des groupes entiers et des promos.
 */
export async function backupPdf(
    url: string,
    relativeDir: string,
    fileName: string,
    previous: ConditionalHeaders = {},
): Promise<{ archived: boolean; etag: string | null; lastModified: string | null; backupPath?: string }> {
    const headers: Record<string, string> = { Accept: "application/pdf" };
    if (previous.etag) headers["If-None-Match"] = previous.etag;
    if (previous.lastModified) headers["If-Modified-Since"] = previous.lastModified;

    const response = await fetch(url, { headers });

    if (response.status === 304) {
        return { archived: false, etag: previous.etag ?? null, lastModified: previous.lastModified ?? null };
    }

    if (!response.ok) {
        throw new Error(`Téléchargement ${url} : HTTP ${response.status}`);
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    const lastModified = response.headers.get("last-modified");
    const backupPath = await archiveFile(relativeDir, fileName, lastModified, buffer);

    return { archived: true, etag: response.headers.get("etag"), lastModified, backupPath };
}

/**
 * Petit index des PDF déjà archivés (`url` → en-têtes de cache).
 *
 * Les PDF ne sont pas exploités par la synchronisation : leur suivi n'a pas sa
 * place en base, un fichier à côté des archives suffit à éviter de les
 * retélécharger à chaque passage.
 */
export type BackupManifest = Record<string, { etag: string | null; lastModified: string | null }>;

const MANIFEST_PATH = path.join(BACKUP_ROOT, "manifest.json");

export async function loadManifest(): Promise<BackupManifest> {
    try {
        const raw = await readFile(MANIFEST_PATH, "utf8");
        return JSON.parse(raw) as BackupManifest;
    } catch {
        return {};
    }
}

export async function saveManifest(manifest: BackupManifest): Promise<void> {
    await mkdir(BACKUP_ROOT, { recursive: true });
    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}
