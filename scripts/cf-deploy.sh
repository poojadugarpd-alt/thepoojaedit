#!/bin/bash
# Build and deploy the store to Cloudflare Workers (D-187).
#
#   scripts/cf-deploy.sh            build + deploy code
#   scripts/cf-deploy.sh --secrets  also re-upload every Worker secret first
#   scripts/cf-deploy.sh --build    build only (no deploy)
#
# Needs: wrangler logged in to the vinayakch17 Cloudflare account, and the
# gitignored key files in .secrets/ (cloudflare-store.env = shell exports used
# at build time; worker-secrets.json = the same values as Worker secrets).
# .env.local (dev Supabase) is moved aside during the build so no dev value
# can leak into the production bundle, and is always put back.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE=deploy SECRETS=0
for a in "$@"; do
  case "$a" in
    --secrets) SECRETS=1 ;;
    --build) MODE=build ;;
    *) echo "unknown option: $a"; exit 1 ;;
  esac
done

[ -f .secrets/cloudflare-store.env ] || { echo "missing .secrets/cloudflare-store.env"; exit 1; }
[ -f .secrets/worker-secrets.json ] || { echo "missing .secrets/worker-secrets.json"; exit 1; }

restore() { [ -f .env.local.cf-aside ] && mv .env.local.cf-aside .env.local; true; }
trap restore EXIT
[ -f .env.local ] && mv .env.local .env.local.cf-aside

# shellcheck disable=SC1091
set -a; source .secrets/cloudflare-store.env; set +a
[ "${NEXT_PUBLIC_APP_ENV:-}" = "production" ] || { echo "NEXT_PUBLIC_APP_ENV is not production"; exit 1; }

npx --no-install opennextjs-cloudflare build
restore

[ "$MODE" = build ] && { echo "built .open-next (not deployed)"; exit 0; }

if [ $SECRETS -eq 1 ]; then
  npx --no-install wrangler secret bulk .secrets/worker-secrets.json
fi
npx --no-install opennextjs-cloudflare deploy
echo "deployed. check: curl -sI https://thepoojaedit.in | head -1"
