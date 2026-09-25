# syntax=docker/dockerfile:1
# ============================================
# 📁 server/Dockerfile
# Image de l'API — construite depuis la racine du dépôt
#
#   docker build -f server/Dockerfile -t iut-room-viewer-server .
#
# Le contexte est la racine parce que les dépendances d'un espace de travail Bun
# se résolvent depuis `bun.lock`, qui vit à la racine : construire depuis
# `server/` donnerait un arbre de dépendances différent de celui du dépôt.
# ============================================

# --- Dépendances -----------------------------------------------------------
# Étape séparée : tant que les manifestes ne bougent pas, Docker réutilise ce
# calque et l'installation n'est pas rejouée à chaque changement de code.
FROM oven/bun:1.3.14-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY server/package.json server/
COPY bot/package.json bot/
COPY web/package.json web/

# `--production` écarte les dépendances de développement : ni TypeScript, ni
# ESLint, ni les types n'ont leur place dans une image qui ne fait que tourner.
#
# Le front dépend de `@gamo/ds`, hébergé sur une forge privée et déclaré dans un
# `.npmrc` qui ne quitte pas le poste de développement : c'est `bun.lock`, avec
# l'URL déjà résolue, qui rend l'installation reproductible ici.
#
# `--filter=server` n'installe que les dépendances de l'API : sans lui, Vue,
# le design system et discord.js entrent aussi dans l'image (186 Mo contre 119).
RUN bun install --frozen-lockfile --production --filter=server

# --- Exécution -------------------------------------------------------------
FROM oven/bun:1.3.14-alpine AS runtime
# Le répertoire de travail est celui du paquet, pas la racine : Bun lit le
# `tsconfig.json` à partir de là, et les entités TypeORM ont besoin de ses
# décorateurs historiques (`experimentalDecorators`). Lancé depuis la racine,
# le serveur compile avec les décorateurs standards et s'arrête au premier
# `@PrimaryGeneratedColumn`.
WORKDIR /app/server

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=deps /app/node_modules /app/node_modules
COPY package.json bun.lock /app/
COPY server /app/server
# Bun ne remonte pas tout à la racine : les dépendances d'un espace de travail
# vivent dans son propre `node_modules`, en liens symboliques vers le magasin.
COPY --from=deps /app/server/node_modules /app/server/node_modules

# L'image de base fournit l'utilisateur `bun` : le serveur ne tourne pas en root.
USER bun

EXPOSE 3000

# Le conteneur sait dire s'il va bien : l'orchestrateur n'a pas à le deviner.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD bun --eval "fetch('http://127.0.0.1:' + (process.env.PORT ?? 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "src/index.ts"]
