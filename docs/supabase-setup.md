# Supabase setup (dev)

Phase 3 needs a Supabase project for Auth + Storage. Local Supabase CLI needs
Docker (not available on this machine), so use a **free hosted dev project**.
~5 minutes, no payment.

## 1. Create the project

1. https://supabase.com → new project (name e.g. `poojaedit-dev`), pick a region
   close to India, save the database password.
2. Project Settings → **API**:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the **publishable** (anon) key
   - keep the **secret** (service) key out of the app unless a flow needs it
     (`SUPABASE_SECRET_KEY`), never in `NEXT_PUBLIC_*`.
3. Project Settings → **Database** → Connection string:
   - `DATABASE_URL` = **Transaction pooler** (port 6543) + `?pgbouncer=true`
   - `DIRECT_URL` = **Session pooler** (port 5432) or the direct connection
   - `SHADOW_DATABASE_URL` = optional; a second disposable DB or leave unset

Put these in `.env.local` (they replace the embedded-Postgres URLs for a
Supabase-backed dev run). To keep using embedded Postgres for day-to-day work and
only point at Supabase when testing auth, keep two files and swap.

## 2. Apply the schema

```bash
npm run db:migrate:deploy      # prisma migrate deploy against the Supabase DB
npm run db:seed                # optional dev fixtures
```

## 3. Lock down the Data API + create Storage buckets

In the Supabase SQL editor, run in order:

- `supabase/policies/01_lock_down_data_api.sql` — revokes PostgREST access to all
  commerce tables from `anon` / `authenticated` / `public`, enables RLS with no
  policies. Prisma (privileged role) is unaffected.
- `supabase/policies/02_storage_buckets.sql` — creates `product-images` (public
  read / admin write) and `documents` (private), plus the policies.

Re-run `01_…` after any migration that adds tables (or trust the
`ALTER DEFAULT PRIVILEGES` lines).

## 4. Auth config

- Authentication → URL configuration → add `http://localhost:3000/auth/callback`
  (and the eventual preview/prod URLs) to the redirect allow-list.
- Email templates / password policy: defaults are fine for dev.

## 5. Owner bootstrap

Set `ADMIN_BOOTSTRAP_TOKEN` to a random secret in `.env.local`. Sign up a normal
account, then call the bootstrap route once with that token to make it OWNER.
Rotate/remove the token afterwards. (Route lands with the admin UI; the guarded
`bootstrapOwner()` service exists now.)

## 6. Then re-run the deferred Phase 3 security checks

- `supabase.auth.getUser()` verification (real JWT), altered-cookie rejection
- signed product-image upload + object confirmation
- private `documents` download only via signed URL
- anon Data API read/write denied (`select * from "Product"` with the anon key)
- the Supavisor-pooler + Prisma 7 concurrency proof (master §3, deferred from
  Phase 2)
