<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { Alert, Button, Modal, ModalBody, ModalHeader, Skeleton, Surface } from "@gamo/ds";
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

/**
 * Du plus large au plus précis. L'API rend l'ordre inverse ; c'est un choix de
 * lecture, il reste donc ici plutôt que dans le contrat.
 */
const LEVEL_ORDER: SourceFile["level"][] = ["year", "group", "subGroup"];

const FORMATS = [
    { format: "pdf", label: "PDF" },
    { format: "ics", label: "ICS" },
] as const;

/** Une colonne par format, et dans chacune l'année en haut, le sous-groupe en bas. */
const columns = computed(() => {
    const files = sources.value?.data.value?.files ?? [];
    return FORMATS.map(({ format, label }) => ({
        format,
        label,
        files: files
            .filter((file) => file.format === format)
            .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)),
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

function scopeLabel(file: SourceFile): string {
    return file.scope ? file.scope.toUpperCase() : "—";
}
</script>

<template>
    <Modal v-model:open="open" size="lg">
        <ModalHeader>Télécharger</ModalHeader>

        <ModalBody>
            <p class="downloads__period">
                <template v-if="weekNumber !== null">Semaine {{ weekNumber }} · </template>{{ period }}
            </p>

            <Skeleton v-if="!hasData && freshness === 'revalidating'" height="12rem" />

            <Alert v-else-if="!hasData" variant="error">Impossible de récupérer la liste des documents.</Alert>

            <Alert v-else-if="weekNumber === null" variant="info">
                L'IUT n'a publié aucun emploi du temps pour cette semaine.
            </Alert>

            <template v-else>
                <!-- Grille à plat, remplie colonne par colonne : les deux colonnes partagent
                     leurs rangées, et une ligne avec bouton n'est pas plus haute que sa voisine. -->
                <div class="downloads">
                    <template v-for="column in columns" :key="column.format">
                        <h3 class="downloads__title">{{ column.label }}</h3>

                        <Surface
                            v-for="file in column.files"
                            :key="`${column.format}-${file.level}`"
                            level="surface"
                            padding="sm"
                            class="downloads__row"
                        >
                            <!-- `A3`, `G8`, `G8A` : la forme du code dit déjà le niveau. -->
                            <span class="downloads__scope">{{ scopeLabel(file) }}</span>

                            <Button
                                v-if="safeUrl(file)"
                                size="sm"
                                outline
                                :href="safeUrl(file)!"
                                :aria-label="`Télécharger ${scopeLabel(file)} en ${column.label}`"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Télécharger
                            </Button>
                            <!-- Même forme que le bouton actif : seul son état dit que le document manque. -->
                            <Button
                                v-else
                                size="sm"
                                outline
                                disabled
                                :aria-label="`${scopeLabel(file)} en ${column.label} : non publié par l'IUT`"
                            >
                                Non publié
                            </Button>
                        </Surface>
                    </template>
                </div>

                <p class="downloads__note">
                    L'IUT ne publie de fichiers ICS que pour les sous-groupes. Seul le PDF de l'année fait foi : ceux des
                    groupes et les ICS contiennent des erreurs connues (S1 et S2).
                </p>
            </template>
        </ModalBody>
    </Modal>
</template>

<style scoped>
.downloads__period {
    margin: 0 0 var(--s4);
    color: var(--muted);
}

.downloads {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: auto repeat(3, 1fr);
    grid-auto-flow: column;
    gap: var(--s2) var(--s4);
}

.downloads__title {
    margin: 0;
    font-size: var(--fs-sm);
    font-weight: 600;
}

/* La police d'affichage du design system, celle de ses titres. */
.downloads__scope {
    font-family: var(--font-display);
    font-size: var(--fs-lg);
    font-weight: 700;
    line-height: 1;
}

.downloads__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s2);
}

/* Sur un téléphone, deux colonnes ne laissent pas la place au bouton : PDF puis
   ICS s'empilent, dans l'ordre même où ils sont écrits. */
@media (max-width: 36rem) {
    .downloads {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: none;
        grid-auto-flow: row;
    }

    .downloads__title:not(:first-child) {
        margin-top: var(--s2);
    }
}

.downloads__note {
    margin: var(--s4) 0 0;
    color: var(--muted);
    font-size: var(--fs-sm);
}
</style>
