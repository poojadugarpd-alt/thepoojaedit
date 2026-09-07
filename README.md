# PoojaEdit.com — The Pooja Edit + Thrift Store

Mobile-first Indian fashion e-commerce site for one brand with two catalogs: **The Pooja Edit** (new apparel) and **Thrift Store** (pre-loved, one-of-one). Solo operator, Instagram-led traffic, low launch cost, real transactions.

## Repository state

**Phases 0–1 passed.** Application foundation is in place: Next.js 15.5 App Router, typed env validation, server-only boundaries, structured logging, money primitive, health endpoint, Vitest + Playwright harness, CI. No commerce logic yet — the database and business schema are Phase 2.

## Development

```bash
nvm use            # Node 22 (see .nvmrc)
npm install
cp .env.example .env.local   # fill in as phases require; dev needs almost nothing yet
npm run dev                  # http://localhost:3000

npm run check      # lint + typecheck + test + build (the CI gate)
npm run test:e2e   # Playwright shell smoke (run `npx playwright install` once)
```

| Script                    | Does                            |
| ------------------------- | ------------------------------- |
| `dev` / `build` / `start` | Next.js                         |
| `lint`                    | ESLint (flat config)            |
| `typecheck`               | `tsc --noEmit`, strict          |
| `test` / `test:watch`     | Vitest unit tests               |
| `test:e2e`                | Playwright                      |
| `format` / `format:check` | Prettier                        |
| `check`                   | lint → typecheck → test → build |

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
| [`docs/compatibility-plan.md`](docs/compatibility-plan.md)           | Pinned stack + version/security guidance (Phase 0 deliverable). |
| [`docs/module-map.md`](docs/module-map.md)                           | Target module boundaries (Phase 0 deliverable).                 |
| [`docs/deferred-scope.md`](docs/deferred-scope.md)                   | Explicitly out of MVP (Phase 0 deliverable).                    |

## Stack (see `docs/compatibility-plan.md` for pins)

Next.js 15 App Router · React 19 · TypeScript · Node 22 LTS · Vercel · Tailwind v4 + shadcn/ui · Prisma 7 (`@prisma/adapter-pg`) · Supabase (Free Postgres + Auth + Storage) · Razorpay · Shiprocket · Inngest + transactional outbox · Resend + React Email · Meta WhatsApp Cloud API · Sentry + Pino · Vitest + Playwright.
