<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { Alert, Modal, ModalBody, ModalHeader, Skeleton } from "@gamo/ds";
import { useCachedResource, type CachedResource } from "../composables/useCachedResource";
import { addDays } from "../composables/useSchedule";
import type { SourceFile, WeekSources } from "../types/api";

const open = defineModel<boolean>("open", { required: true });

const { group, monday } = defineProps<{
    /** Code du groupe consulté : `G8a`. */
    group: string | null;
    /** Lundi de la semaine affichée, à minuit local. */
    monday: Date;
}>();

/**
 * La ressource n'est créée qu'à l'ouverture : les documents d'une semaine ne
 * servent qu'ici, et chaque ouverture redemande l'état du jour — un document
 * de groupe peut être publié entre deux consultations.
 */
const sources = shallowRef<CachedResource<WeekSources> | null>(null);

watch(open, (isOpen) => {
    if (!isOpen || !group) return;

    const start = monday.toISOString();
    const params = new URLSearchParams({ group, start_at: start });

    sources.value = useCachedResource<WeekSources>(
        `sources:${group}:${start.slice(0, 10)}`,
        () => `/api/v1/sources?${params.toString()}`,
    );
});

const LEVEL_LABELS: Record<SourceFile["level"], string> = {
    subGroup: "Sous-groupe",
    group: "Groupe",
    year: "Année",
};

const FORMATS = [
    { format: "pdf", label: "PDF" },
    { format: "ics", label: "ICS" },
] as const;

/** Une colonne par format, et dans chacune le sous-groupe en haut, l'année en bas. */
const columns = computed(() => {
    const files = sources.value?.data.value?.files ?? [];
    return FORMATS.map(({ format, label }) => ({
        format,
        label,
        files: files.filter((file) => file.format === format),
    }));
});

const weekNumber = computed(() => sources.value?.data.value?.weekNumber ?? null);
const freshness = computed(() => sources.value?.freshness.value ?? "revalidating");
const hasData = computed(() => (sources.value?.data.value?.files.length ?? 0) > 0);

const period = computed(() => {
    const format = (date: Date) => date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    return `${format(monday)} → ${format(addDays(monday, 5))}`;
});

/**
 * Les adresses viennent du listing de l'IUT, relu par le serveur : seul le
 * HTTPS est suivi, tout autre schéma est traité comme un document absent.
 */
function safeUrl(file: SourceFile): string | null {
    if (!file.url) return null;
    try {
        return new URL(file.url).protocol === "https:" ? file.url : null;
    } catch {
        return null;
    }
}

function fileName(url: string): string {
    return decodeURIComponent(url.split("/").pop() ?? url);
}

function scopeLabel(file: SourceFile): string {
    return file.scope ? file.scope.toUpperCase() : "—";
}
</script>

<template>
    <Modal v-model:open="open" size="lg">
        <ModalHeader>
            Télécharger
            <span class="downloads__week">
                <template v-if="weekNumber !== null">semaine S{{ weekNumber }} · </template>{{ period }}
            </span>
        </ModalHeader>

        <ModalBody>
            <Skeleton v-if="!hasData && freshness === 'revalidating'" height="12rem" />

            <Alert v-else-if="!hasData" variant="error">
                Impossible de récupérer la liste des documents.
            </Alert>

            <Alert v-else-if="weekNumber === null" variant="info">
                L'IUT n'a publié aucun emploi du temps pour cette semaine.
            </Alert>

            <template v-else>
                <div class="downloads">
                    <section v-for="column in columns" :key="column.format" class="downloads__column">
                        <h3 class="downloads__heading">{{ column.label }}</h3>

                        <ul class="downloads__list">
                            <li v-for="file in column.files" :key="file.level" class="downloads__item">
                                <span class="downloads__level">
                                    {{ LEVEL_LABELS[file.level] }}
                                    <strong>{{ scopeLabel(file) }}</strong>
                                </span>

                                <a
                                    v-if="safeUrl(file)"
                                    class="downloads__link"
                                    :href="safeUrl(file)!"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {{ fileName(safeUrl(file)!) }}
                                </a>
                                <span v-else class="downloads__missing">non publié</span>
                            </li>
                        </ul>
                    </section>
                </div>

                <p class="downloads__note">
                    L'IUT ne publie de fichiers ICS que pour les sous-groupes. Seul le PDF de l'année fait foi : ceux
                    des groupes et les ICS contiennent des erreurs connues.
                </p>
            </template>
        </ModalBody>
    </Modal>
</template>

<style scoped>
.downloads__week {
    display: block;
    margin-top: var(--s1);
    color: var(--muted);
    font-family: var(--font-body);
    font-size: var(--fs-sm);
    font-weight: 400;
}

.downloads {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s4);
}

.downloads__heading {
    margin: 0 0 var(--s2);
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    font-weight: 600;
    letter-spacing: 0.08em;
}

.downloads__list {
    display: flex;
    flex-direction: column;
    gap: var(--s2);
    margin: 0;
    padding: 0;
    list-style: none;
}

.downloads__item {
    display: flex;
    flex-direction: column;
    gap: var(--s1);
    padding: var(--s3);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--surface);
}

.downloads__level {
    color: var(--muted);
    font-size: var(--fs-sm);
}

.downloads__level strong {
    color: var(--text);
    font-family: var(--font-mono);
}

.downloads__link {
    overflow: hidden;
    color: var(--lav);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.downloads__link:hover {
    text-decoration: underline;
}

.downloads__missing {
    color: var(--muted);
    font-size: var(--fs-sm);
    font-style: italic;
}

.downloads__note {
    margin: var(--s4) 0 0;
    color: var(--muted);
    font-size: var(--fs-xs);
}
</style>
