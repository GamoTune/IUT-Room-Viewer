<script setup lang="ts">
import { Select, SelectOption } from "@gamo/ds";
import { useGroups } from "../composables/useGroups";

const model = defineModel<string | null>({ required: true });
const groups = useGroups();
</script>

<template>
    <Select v-if="groups.data.value" v-model="model" aria-label="Groupe" placeholder="Mon groupe">
        <SelectOption v-for="group in groups.data.value" :key="group.code" :value="group.code">
            {{ group.label }}
        </SelectOption>
    </Select>
</template>
