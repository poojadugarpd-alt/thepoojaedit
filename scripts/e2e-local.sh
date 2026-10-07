#!/usr/bin/env bash
# Run the Playwright suite locally the way CI does (.github/workflows/ci.yml,
# `e2e` job): a throwaway local Postgres database, DEV_ADMIN_AUTH=1, and every
# real provider blanked so .env.local's real keys are ignored (an empty value
# counts as unset — src/lib/env.ts, src/lib/public-env.ts). Without this the
# admin specs fail locally: DEV_ADMIN_AUTH only applies when Supabase is NOT
# configured, and .env.local has a real Supabase project (D-135).
#
#   npm run db:dev          # terminal 1 — local Postgres on :5433
#   npm run test:e2e:local  # terminal 2 — extra args go to Playwright
set -euo pipefail

# A fresh database per run (never reset/dropped — nothing destructive runs here),
# exactly like CI's fresh service container. Old ones are tiny and local-only.
DB="postgresql://postgres:postgres@127.0.0.1:5433/poojaedit_e2e_$(date +%s)"
export DATABASE_URL="$DB" DIRECT_URL="$DB" SHADOW_DATABASE_URL=""
export NEXT_PUBLIC_SITE_URL="http://localhost:3100" DEV_ADMIN_AUTH="1"
export NEXT_PUBLIC_APP_ENV="development"

for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  NEXT_PUBLIC_STORAGE_PUBLIC_URL SUPABASE_SECRET_KEY ADMIN_BOOTSTRAP_TOKEN \
  NEXT_PUBLIC_RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET \
  SHADOWFAX_API_TOKEN SHADOWFAX_WEBHOOK_TOKEN SHADOWFAX_API_BASE \
  WHATSAPP_ACCESS_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_VERIFY_TOKEN META_APP_SECRET \
  RESEND_API_KEY EMAIL_FROM RESEND_WEBHOOK_SECRET INNGEST_EVENT_KEY INNGEST_SIGNING_KEY \
  NEXT_PUBLIC_VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT BEHOLD_FEED_ID SENTRY_DSN; do
  export "$k="
done

if ! (echo > /dev/tcp/127.0.0.1/5433) 2>/dev/null; then
  echo "Local Postgres isn't running on :5433 — start it with: npm run db:dev" >&2
  exit 1
fi

echo "→ creating a fresh local e2e database"
npx prisma migrate deploy
npm run db:seed
echo "→ building with blanked providers"
npm run build
echo "→ running Playwright"
npx playwright test "$@"
