# Build Progress

Stable architecture: [01-master-specification.md](01-master-specification.md) · Execution control: [02-execution-playbook.md](02-execution-playbook.md)

Status vocabulary: `not-started` · `in-progress` · `blocked` · `passed`

## Current position

| Field | Value |
| --- | --- |
| Authorized phase range | Phases 0–1 |
| Current phase | Phase 1 — Application foundation and environment isolation |
| Phase 0 status | `passed` (2026-09-07) |
| Phase 1 status | `passed` (2026-09-07) — checkpoint reported, awaiting Phase 2 authorization |
| Last commit | _see git log — `docs: Phase 0 baseline` then `chore: Phase 1 application foundation`_ |
| Tests run | `npm run lint` ✓ · `npm run typecheck` ✓ · `npm run test` ✓ 19/19 · `npm run build` ✓ · `npm run test:e2e` ✓ 4/4 (chromium) · `npm audit --audit-level=high` ✓ 0 vulns |
| Next task | User authorizes Phase 2 (database, Prisma, business schema) |

## Phase ledger

| Phase | Title | Status | Commit | Evidence |
| --- | --- | --- | --- | --- |
| 0 | Inspect and freeze the implementation baseline | `passed` | `docs: Phase 0 baseline` | This file + `compatibility-plan.md`, `module-map.md`, `acceptance-evidence.md`, `integration-setup.md`, `operations-runbook.md`, `decisions.md`, `deferred-scope.md` |
| 1 | Application foundation and environment isolation | `passed` | `chore: Phase 1 application foundation` | Next.js 15.5.25 app; `src/lib/{app-env,env,public-env,logger,money}.ts`; domain folders `src/server/*`, `src/features/*`; `/api/health`; middleware; instrumentation; Vitest (19) + Playwright (4) harness; `.github/workflows/ci.yml`; `.env.example`. See "Phase 1 checkpoint" below. |
| 2 | Database, migrations, Prisma and business schema | `not-started` | — | — |
| 3 | Authentication, authorization and asset storage | `not-started` | — | — |
| 4 | Product administration and dual storefronts | `not-started` | — | — |
| 5 | Pricing, tax, inventory and checkout core | `not-started` | — | — |
| 6 | Durable event delivery and scheduled recovery | `not-started` | — | — |
| 7 | Razorpay and end-to-end prepaid/COD checkout | `not-started` | — | — |
| 8 | Shiprocket and shipping operations | `not-started` | — | — |
| 9 | Invoices, refunds and returns | `not-started` | — | — |
| 10 | Notifications and delivery observability | `not-started` | — | — |
| 11 | Complete the operator dashboard | `not-started` | — | — |
| 12 | Full-system verification and preview readiness | `not-started` | — | — |
| 13 | Operational handover and authorized production launch | `not-started` | — | — |

## Repository baseline (as inspected 2026-09-07)

- Fresh git repository at `~/Documents/PoojaEdit`, branch `main`.
- Phase 0 established `docs/` (two specs + working records). Phase 1 scaffolded the Next.js app.
- **No prior application code existed** — nothing to preserve or reuse; nothing to avoid duplicating.
- Local toolchain: Node v24.18.0, npm 11.16.0. Node 24 is **not** the target runtime — `.nvmrc`/`engines` pin Node 22 LTS to match Vercel. `npm install` prints one `EBADENGINE` warning locally as a result; this is expected and non-blocking.

## Phase 1 checkpoint — evidence (2026-09-07)

| Playbook §4 check | Result |
| --- | --- |
| Clean install | `rm package-lock.json && npm install` → 400 pkgs, **0 vulnerabilities** (postcss forced to 8.5.28 via `overrides`; see `decisions.md` D-13) |
| Lint | `npm run lint` (eslint flat config, `next/core-web-vitals` + `next/typescript`) — clean |
| Type check | `npm run typecheck` (`tsc --noEmit`, strict) — clean |
| Unit smoke test | `npm run test` (Vitest) — **19/19** across `money`, `app-env`, `env` guard, `/api/health` route |
| Production build | `npm run build` — success; 5 routes, middleware 34.6 kB, `/api/health` dynamic, catalog/home static |
| Missing required config → useful error | Demonstrated end-to-end: a build with `APP_ENV=production` and no DB url fails with the aggregated Zod message (`• DATABASE_URL: … required when APP_ENV=production`). Guard logic in `src/lib/env.ts`. |
| Browser bundles contain no secrets | `grep` of `.next/static` for every server secret var name and for `pino`/server-only marker → none present |
| Preview cannot resolve live credentials by fallback | `assertNoLiveCredentialsOutsideProduction()` in `src/lib/env.ts` rejects `rzp_live_*` / `SENTRY_ENVIRONMENT=production` outside production; unit-tested. No fallback source is read for any var. |
| E2E harness | `npm run test:e2e --project=chromium` — **4/4** (home has both catalogue entrances, primary nav reaches both catalogues, skip link is first focusable, `/api/health` 200) |
| CI | `.github/workflows/ci.yml` — `verify` job (install/lint/typecheck/test/build/`npm audit --audit-level=high`) + `e2e` job (Playwright chromium). Not yet run on a remote (no GitHub remote configured). |

**Covers:** part of **AC-17** (clean build + tests + lint/type). Migration and preview-deploy portions of AC-17 remain for Phases 2 and 12.

**Limitations / notes carried forward:**
- No GitHub remote yet — CI workflow is committed but unexecuted.
- Playwright `mobile` project defined but only `chromium` run locally; browsers download in CI.
- Sentry SDK not installed — `instrumentation.ts` has the hook point, DSN-guarded init lands with monitoring wiring.
- Catalog routes (`/the-pooja-edit`, `/thrift`) are "coming soon" placeholders — real listings are Phase 4.

## Phase 0 checkpoint — self-assessment against playbook §3

| Check | Result |
| --- | --- |
| Every fixed technology accounted for | Yes — see `compatibility-plan.md` stack table |
| No stale Cloudinary / Auth.js / MongoDB decision retained | Confirmed — no prior code exists; `decisions.md` records Supabase Auth + Supabase Storage + PostgreSQL as the only identity/storage/DB choices |
| Existing work preserved | N/A — greenfield repo, nothing to preserve |
| Secrets absent from repo | Yes — no `.env*` committed (`.gitignore` blocks them); only `.env.example` with empty values |
| Live configuration blockers listed | Yes — see `integration-setup.md` and the "Blockers" section below |
| Any mandated version that cannot safely deploy | None. Next.js 15.5.x is Maintenance LTS and still security-patched; all other pins are current. One watch item (Next.js 16 is now Active LTS) is recorded in `decisions.md` as a future proposal, not a Phase 0 blocker |

## Blockers / information needed before later phases

None blocked Phase 1. **Phase 2 needs item 1 below** (a dev PostgreSQL/Supabase). Recorded so they are not rediscovered late:

1. **Supabase projects** (dev + prod) *or* a local PostgreSQL — needed from Phase 2. Dev-database choice (local Docker Postgres vs local Supabase CLI vs hosted Supabase dev project) is `decisions.md` D-open-3. Free-tier allowances, pause behavior and backup entitlement to be verified against the live account when a hosted project is used.
2. **Razorpay test account** — needed from Phase 7.
3. **Shiprocket account + confirmation of an available test/sandbox mode** — needed from Phase 8. AC-13 stays blocked until this is confirmed.
4. **Meta WhatsApp Cloud API + approved templates**, **Resend verified sender** — needed from Phase 10.
5. **Inngest account (dev)** — needed from Phase 6.
6. **Real business/tax configuration** — legal name, GSTIN, supplier state/address, HSN + rates, invoice series, contact details, policy text. Needed for live checkout/invoices (Phases 5, 9, 13). Development proceeds on clearly labelled fixtures until the owner confirms these.
7. **Deploy target** — Vercel project + isolated preview environment, needed from Phase 12.

## Update rules

- Update this file at every phase checkpoint: set the phase status, record the checkpoint commit, list tests actually run and their results, and name the exact next task.
- Never record "all tests pass" when required tests were skipped — record skipped provider tests as `blocked`.
