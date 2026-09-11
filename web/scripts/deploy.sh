#!/usr/bin/env bash
#
# Déploiement manuel du front vers iut.gamo.one, par SFTP.
#
#   cp .env.deploy.example .env.deploy   # puis renseigner login et hôte
#   DRY_RUN=1 bun run deploy             # simulation
#   bun run deploy                       # envoi réel
#
# Le chemin normal est un tag `web-v*` et la CI ; ce script est le secours quand
# la forge est hors ligne — et le seul chemin tant que le dépôt vit sur GitHub,
# où le workflow Forgejo ne se déclenche pas.
#
# Le mot de passe est demandé par lftp : il n'est ni stocké ni passé en argument,
# où il apparaîtrait dans l'historique du shell et dans `ps`.
set -euo pipefail

command -v lftp >/dev/null || {
    echo "lftp est requis :  brew install lftp" >&2
    exit 1
}

cd "$(dirname "$0")/.."

if [ -f .env.deploy ]; then
    set -a
    # shellcheck disable=SC1091  # fichier local, absent du dépôt par construction
    . ./.env.deploy
    set +a
fi

: "${DEPLOY_USER:?DEPLOY_USER manquant — voir .env.deploy.example}"
: "${DEPLOY_HOST:?DEPLOY_HOST manquant — voir .env.deploy.example}"
DEPLOY_PATH="${DEPLOY_PATH:-www/iut}"

# L'hôte se recopie volontiers depuis un navigateur ou un client FTP avec son
# schéma : `sftp://http://…` ne résout évidemment pas, et l'erreur est opaque.
DEPLOY_HOST="${DEPLOY_HOST#*://}"
DEPLOY_HOST="${DEPLOY_HOST%%/*}"

echo "→ Build du front"
bun run build

test -f dist/index.html || { echo "dist/index.html absent." >&2; exit 1; }

# Le mutualisé n'héberge pas l'API : sans cette racine dans le bundle, le site
# interrogerait sa propre origine et n'obtiendrait que des 404.
API="${VITE_API_BASE_URL:-$(grep -h '^VITE_API_BASE_URL=' .env.production 2>/dev/null | cut -d= -f2-)}"
if [ -n "$API" ]; then
    grep -qr "$API" dist/assets/ || {
        echo "La racine de l'API ($API) n'est pas dans le bundle." >&2
        exit 1
    }
else
    echo "⚠️  Aucune racine d'API connue : le site déployé interrogera sa propre origine." >&2
fi

DRY=""
[ "${DRY_RUN:-}" = "1" ] && DRY="--dry-run"

echo "→ Envoi vers ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}${DRY:+ (simulation)}"
lftp -u "$DEPLOY_USER" "sftp://$DEPLOY_HOST" \
    -e "mirror --reverse --delete --verbose $DRY --exclude-glob '.DS_Store' dist/ '$DEPLOY_PATH/'; bye"

echo "✓ Terminé"
