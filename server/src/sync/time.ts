// ============================================
// 📁 src/sync/time.ts
// Conversion des heures locales de l'IUT en instants
// ============================================

/**
 * Décalage de l'Europe/Paris par rapport à UTC, en minutes, à un instant donné.
 * Calculé via l'`Intl` du runtime plutôt qu'en codant en dur les règles d'été.
 */
function parisOffsetMinutes(instant: Date): number {
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

    const parts = formatter.formatToParts(instant);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");

    const hour = value("hour") === 24 ? 0 : value("hour");
    const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), hour, value("minute"), value("second"));

    return (asUtc - instant.getTime()) / 60000;
}

/**
 * Convertit une date et une heure de Paris en instant.
 *
 * Deux passes : le décalage dépend de l'instant, qu'on ne connaît qu'après
 * l'avoir appliqué — ce qui compte de part et d'autre du changement d'heure.
 */
export function parisToUtc(date: Date, minutesFromMidnight: number): Date {
    const naive = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        minutesFromMidnight,
    );

    let offset = parisOffsetMinutes(new Date(naive));
    let instant = naive - offset * 60000;
    offset = parisOffsetMinutes(new Date(instant));

    return new Date(naive - offset * 60000);
}

/** Ajoute des jours à une date, sans toucher à l'heure. */
export function addDays(date: Date, days: number): Date {
    const result = new Date(date.getTime());
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}
