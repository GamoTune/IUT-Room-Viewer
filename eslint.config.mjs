// ============================================
// 📁 eslint.config.mjs
// Règles de lint, communes aux trois paquets du monorepo
// ============================================

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
    {
        ignores: ["**/node_modules/**", "web/dist/**", "server/coverage/**", "server/data/**", "**/*.d.ts"],
    },

    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...vue.configs["flat/recommended"],

    // Le front est en TypeScript dans des `<script setup lang="ts">` : sans ce
    // parseur interne, `vue-eslint-parser` lit le contenu comme du JavaScript.
    {
        files: ["web/**/*.vue"],
        languageOptions: {
            parserOptions: { parser: tseslint.parser },
        },
        rules: {
            // Le type de la prop dit déjà qu'elle est facultative, et la distinction
            // entre « absente » et « nulle » porte du sens ici : une valeur par défaut
            // l'effacerait. Règle pensée pour l'API d'options, pas pour `script setup`.
            "vue/require-default-prop": "off",
        },
    },

    {
        languageOptions: {
            globals: { ...globals.node, ...globals.browser },
        },
        rules: {
            // Un paramètre ou une capture d'erreur préfixé d'un `_` est
            // volontairement inutilisé : la convention vaut déclaration d'intention.
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
        },
    },

    // Toujours en dernier : neutralise les règles de style qui feraient double
    // emploi avec Prettier, seul maître de la mise en forme.
    prettier,
);
