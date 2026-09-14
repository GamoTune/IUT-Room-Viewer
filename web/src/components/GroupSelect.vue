<script setup lang="ts">
import { Select, SelectOption, SelectSeparator } from "@gamo/ds";
import { useGroups } from "../composables/useGroups";

const model = defineModel<string | null>({ required: true });
const groups = useGroups();

/** The API sorts groups by year then main group, so a main group starts wherever it differs from the previous one. */
function startsMainGroup(index: number): boolean {
    const list = groups.data.value;
    if (!list || index === 0) return false;
    const current = list[index];
    const previous = list[index - 1];
    return current?.year !== previous?.year || current?.mainGroup !== previous?.mainGroup;
}
</script>

<template>
    <Select v-if="groups.data.value" v-model="model" aria-label="Groupe" placeholder="Mon groupe">
        <template v-for="(group, index) in groups.data.value" :key="group.code">
            <SelectSeparator v-if="startsMainGroup(index)" />
            <SelectOption :value="group.code">{{ group.label }}</SelectOption>
        </template>
    </Select>
</template>
