import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
    plugins: [vue()],
    server: {
        port: 5180,
        proxy: {
            // Le front parle à l'API sans se soucier de son origine :
            // en développement Vite relaie, en production c'est le proxy.
            "/api": {
                target: process.env.API_URL ?? "http://127.0.0.1:3010",
                changeOrigin: true,
            },
        },
    },
});
