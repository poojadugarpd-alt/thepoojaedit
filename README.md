# PoojaEdit.com — The Pooja Edit, by Pooja Dugar

Mobile-first Indian fashion e-commerce site for one brand with two catalogs: **The Label** (new apparel) and **The Closet** (pre-loved, one-of-one, from Pooja's own wardrobe). Solo operator, Instagram-led traffic, low launch cost, real transactions.

## Repository state

**Phases 0–3 passed** (Phase 3 partial — live Supabase security evidence pending a dev project; see `docs/supabase-setup.md`). Foundation + full commerce DB (Prisma 7, 42 models, 2 migrations, seed) + auth layer: Supabase SSR clients, `requireAdmin`/`requireOwner` + role/ownership guards, double-gated owner bootstrap, hashed guest order access tokens, server-derived signed image uploads, Data-API-lockdown & Storage RLS SQL. 34 unit + 38 real-PostgreSQL integration tests. Catalog/storefront is Phase 4.

## Development

```bash
nvm use                  # Node 22 (see .nvmrc)
npm install
cp .env.example .env.local

# database — real PostgreSQL, no Docker / no account (embedded-postgres)
npm run db:dev           # terminal 1: PG on :5433, prints the .env.local URLs
npm run db:migrate       # terminal 2: apply migrations to the dev DB
npm run db:seed          # load fixtures (idempotent)

npm run dev              # http://localhost:3000

npm run check            # prisma generate → lint → typecheck → unit test → build (CI gate)
npm run test:integration # 18 real-PostgreSQL tests (needs `npm run db:dev` running)
npm run test:e2e         # Playwright shell smoke (run `npx playwright install` once)
```

| Script                                          | Does                                                |
| ----------------------------------------------- | --------------------------------------------------- |
| `dev` / `build` / `start`                       | Next.js                                             |
| `lint` · `typecheck` · `format`                 | ESLint · `tsc --noEmit` · Prettier                  |
| `test` / `test:integration` / `test:e2e`        | Vitest unit · Vitest real-PostgreSQL · Playwright   |
| `check`                                         | `prisma generate` → lint → typecheck → test → build |
| `db:dev`                                        | Start local embedded PostgreSQL (:5433)             |
| `db:migrate` / `db:migrate:deploy` / `db:reset` | Prisma Migrate                                      |
| `db:seed` · `db:studio` · `db:generate`         | Seed · Studio · generate client                     |

## Documents

| File                                                                 | Role                                                            |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`docs/01-master-specification.md`](docs/01-master-specification.md) | Stable architecture + required behavior. Source of truth.       |
| [`docs/02-execution-playbook.md`](docs/02-execution-playbook.md)     | Phase sequence, prompts, review gates.                          |
| [`docs/build-progress.md`](docs/build-progress.md)                   | Current phase, status, next task.                               |
| [`docs/decisions.md`](docs/decisions.md)                             | Implementation decisions + approved changes.                    |
| [`docs/acceptance-evidence.md`](docs/acceptance-evidence.md)         | AC-01…AC-18 → evidence.                                         |
| [`docs/integration-setup.md`](docs/integration-setup.md)             | Accounts, env var names, callback URLs. No secrets.             |
| [`docs/operations-runbook.md`](docs/operations-runbook.md)           | Deploy/migrate, schedules, backup/restore, rollback.            |
| [`docs/supabase-setup.md`](docs/supabase-setup.md)                   | Create the dev Supabase project; apply lockdown SQL.            |
| [`docs/compatibility-plan.md`](docs/compatibility-plan.md)           | Pinned stack + version/security guidance (Phase 0 deliverable). |
| [`docs/module-map.md`](docs/module-map.md)                           | Target module boundaries (Phase 0 deliverable).                 |
| [`docs/deferred-scope.md`](docs/deferred-scope.md)                   | Explicitly out of MVP (Phase 0 deliverable).                    |

## Stack (see `docs/compatibility-plan.md` for pins)

Next.js 15 App Router · React 19 · TypeScript · Node 22 LTS · Vercel · Tailwind v4 + shadcn/ui · Prisma 7 (`@prisma/adapter-pg`) · Supabase (Free Postgres + Auth + Storage) · Razorpay · Shiprocket · Inngest + transactional outbox · Resend + React Email · Meta WhatsApp Cloud API · Sentry + Pino · Vitest + Playwright.
