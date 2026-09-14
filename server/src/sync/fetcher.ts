// ============================================
// 📁 src/sync/fetcher.ts
// Téléchargement conditionnel et archivage des fichiers
// ============================================

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
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
 * Récupère un fichier en requête conditionnelle.
 *
 * Le serveur de l'IUT expose `ETag` et `Last-Modified` : tant qu'il répond
 * 304, le contenu est identique et il n'y a rien à relire.
 */
export async function fetchDocument(
    url: string,
    relativeDir: string,
    fileName: string,
    previous: ConditionalHeaders = {},
): Promise<FetchOutcome> {
    const headers: Record<string, string> = { Accept: "application/pdf, text/calendar" };
    if (previous.etag) headers["If-None-Match"] = previous.etag;
    if (previous.lastModified) headers["If-Modified-Since"] = previous.lastModified;

    const response = await fetch(url, { headers });

    if (response.status === 304) {
        return { status: "unchanged" };
    }

    if (!response.ok) {
        throw new Error(`Téléchargement ${url} : HTTP ${response.status}`);
    }

    const content = new Uint8Array(await response.arrayBuffer());
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
