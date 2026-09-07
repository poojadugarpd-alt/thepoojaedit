# Compatibility & Lockfile Plan (Phase 0)

Purpose: pin a compatible, supported patch set for every fixed technology in the master specification §2, record the current official compatibility/security guidance consulted, and flag anything that cannot safely deploy. Versions here are the **plan**; the actual lockfile is produced in Phase 1 and the exact resolved versions recorded back into this file and `decisions.md`.

Guidance consulted: 2026-09-07, via web (nodejs.org, nextjs.org/blog, prisma.io blog + docs, ui.shadcn.com). Re-verify the "latest patch" columns at Phase 1 scaffold time — patch releases move.

## Runtime & package manager

| Item | Pin / plan | Notes |
| --- | --- | --- |
| Node.js | **22.x LTS**, pinned to the latest 22 LTS security release at scaffold time (22.22.3 was May 2026; a July 2026 security release followed — take the newest 22.x). Pin via `.nvmrc` + `package.json` `engines.node: "22.x"` + Vercel project setting. | Master §2 mandates Node 22 on Vercel. Node 22 line is **Maintenance LTS**, EOL 2027-04-30 — supported through the intended launch window. Local machine currently runs Node 24.18.0; developers must `nvm use 22` for parity. |
| Package manager | **pnpm**, pinned via `package.json` `packageManager` field and Corepack. Exact version chosen at Phase 1. | npm is acceptable if the user prefers; decision recorded in `decisions.md`. Single lockfile committed either way. |
| npm (bundled) | Whatever ships with the pinned Node 22 (npm 10.9.x). | Only relevant if npm is chosen over pnpm. |

## Application framework

| Item | Pin / plan | Notes |
| --- | --- | --- |
| Next.js | **15.5.x**, latest patch (15.5.24 as of 2026-08 security release). App Router. | Master §2 mandates Next.js 15 App Router; the spec explicitly does **not** authorize a major upgrade. 15.5.x is **Maintenance LTS** and is still receiving security patches (Aug 2026 release patched 15.5.24 alongside 16.3.3). **Safe to deploy.** See watch item W-1 below. |
| React / React DOM | **19.2.x**, latest patch (19.2.8 was Jul 2026). | Required by Next.js 15.1+; App Router + Pages Router both support React 19 stable. |
| TypeScript | **5.x**, latest 5 minor at scaffold. `strict: true`. | — |

### Security guidance for the Next.js 15 line

- Keep pinned to the newest 15.5.x patch. Known criticals that 15.5.24 addresses: CVE-2025-66478 (RSC protocol RCE, CVSS 10.0), CVE-2025-55184 (RSC DoS), CVE-2025-55183 (source exposure), plus two criticals from the Aug 2026 release.
- Phase 1 CI must fail on a known-vulnerable Next.js version (`npm audit` / equivalent gate).

## Commerce data layer

| Item | Pin / plan | Notes |
| --- | --- | --- |
| Prisma ORM (`prisma` + `@prisma/client`) | **7.x**, latest patch (7.10.x line as of 2026-09; 7.2.0 restored the `--url` flag). | Master §2 mandates Prisma 7. Prisma 7 is **stable, recommended for production, supported ~12 months**. Rust-free client. Prisma 8 is in RC (`8.0.0-rc.x`) — **not** adopted; no upgrade authorized. `@prisma/prisma7` compat package exists if a future v8 coexistence is ever needed. |
| Driver adapter | **`@prisma/adapter-pg`** + **`pg`**, versions matched to the Prisma 7 patch. | Master §3: construct the runtime client with `@prisma/adapter-pg` + `pg` + `DATABASE_URL`. Prove under concurrency in Phase 2. |
| Prisma CLI config | `schema.prisma` keeps `provider = "postgresql"` and generated-client `output`; CLI datasource URL goes in **`prisma.config.ts`** (Prisma 7 style), explicitly loading env. | Master §3. `prisma.config.ts` points at `DIRECT_URL`; runtime client uses pooled `DATABASE_URL`. |

## Database & connections (Supabase)

| Item | Pin / plan | Notes |
| --- | --- | --- |
| Database | **Supabase Free PostgreSQL** — separate dev + prod projects where the account allows; local Supabase acceptable for dev. | Master §3. Verify Free-tier allowances / pause behavior / backup entitlement against the live account in Phase 2 and again at Phase 13 — do not assume. |
| `DATABASE_URL` (runtime) | Supavisor **transaction pooler**, port **6543**, `?pgbouncer=true`. Conservative adapter pool size + timeouts for serverless. Reusable client per process (no connect/disconnect per request). | Master §3. |
| `DIRECT_URL` (CLI) | Supavisor **session mode**, port **5432** (or a real direct connection where network allows). | Master §3. Used by `prisma migrate` / `prisma studio`. |
| `SHADOW_DATABASE_URL` | Optional disposable shadow DB for `prisma migrate dev` when needed. | Master §3. |

Prisma↔Supabase specifics to validate in Phase 2 (not assumed now):

- Transaction-pooler + Prisma 7 driver-adapter prepared-statement behavior — do **not** copy legacy Rust-engine query params blindly; confirm what the `pg` adapter + Supavisor actually need.
- Never disable TLS certificate verification to make a connection test pass.
- Prisma owns application tables only; `auth` and `storage` schemas are Supabase-managed and off-limits to migrations.
- SQL constraints / RLS / grants / policies are versioned alongside migrations with explicit ownership comments.

## Identity & storage

| Item | Pin / plan | Notes |
| --- | --- | --- |
| `@supabase/ssr` | Latest. | Master §2/§9. Session refresh via Next.js 15-compatible **middleware** (`src/middleware.ts`) — ignore newer-framework `proxy.ts` naming in current Supabase examples. |
| `@supabase/supabase-js` | Latest, matched to `@supabase/ssr`. | Auth + Storage SDK use only; never for commerce reads/writes (those go through Prisma). |
| Env var names | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_SECRET_KEY` (only if needed). | Master §3 uses the current publishable/secret key naming, not the legacy `anon`/`service_role` labels. |

## UI / forms / client state

| Item | Pin / plan | Notes |
| --- | --- | --- |
| Tailwind CSS | **v4.x** (CSS-first config via `@theme` in a global stylesheet; no `tailwind.config.ts` needed). | shadcn/ui + Tailwind v4 + Next.js 15 + React 19 is the current supported combination. If v4 friction appears in Phase 1, falling back to Tailwind v3 is a recorded decision, not an architecture change. |
| shadcn/ui | Current CLI (v2+), components copied into the repo (`src/components/ui`). Radix primitives as needed. | Master §2. "Ownership" model — updates are reviewed diffs. |
| `next-themes` | Latest, for light/dark. | Optional; only if the design calls for it. |
| Zod | v4.x latest. | Validation + env parsing + snapshot schemas. |
| React Hook Form | Latest. | Forms. |
| Zustand | Latest. | Persisted cart (variant IDs + quantities) + transient UI only. Master §4. |

## Integrations (adapters — pinned when their phase starts)

| Item | Plan | Phase |
| --- | --- | --- |
| Razorpay | Server SDK + raw-body webhook verification. Provider-neutral interface; Cashfree is an interface-only future adapter, labelled disabled. | 7 |
| Shiprocket | Typed HTTP client, server-side credential refresh. Callback verification uses the provider's **actual** documented mechanism — no invented HMAC header. | 8 |
| Inngest | `inngest` SDK + transactional outbox. Real deployed schedules; no in-process timers / Vercel request-lifetime reliance. | 6 |
| WhatsApp | Meta WhatsApp Cloud API behind an abstraction; approved templates only. | 10 |
| Email | `resend` + React Email (`@react-email/*`), versioned templates. | 10 |
| Monitoring | `@sentry/nextjs` + `pino` structured logs with PII/secret redaction. | 1 (harness) / ongoing |

## Tests

| Item | Pin / plan | Notes |
| --- | --- | --- |
| Vitest | Latest. Unit + integration. | Master §2. |
| Real PostgreSQL integration tests | Required for transactions, uniqueness, locks, concurrency. SQLite / mocked Prisma are **not acceptable** for those guarantees (playbook §2.4). Disposable local Postgres (Docker or local Supabase). | From Phase 2. |
| Playwright | Latest. Browser journeys. | From Phase 4. |

## Watch items (not Phase 0 blockers)

- **W-1 — Next.js 16 is now Active LTS; 15.5.x is Maintenance LTS.** The spec mandates 15 and forbids a silent major upgrade. 15.5.x remains security-supported, so launching on it is acceptable. If the Maintenance window looks like it will close before or soon after launch, raise an **architecture gate** proposal to move to Next.js 16 (compatibility/migration/AC impact written up first). Tracked in `decisions.md` as D-open-1.
- **W-2 — Prisma 8 RC in progress.** Stay on 7.x for the whole build. Revisit only post-launch.
- **W-3 — Tailwind v4 vs v3.** Default to v4; record a fallback decision if scaffolding hits blockers.
- **W-4 — Node 22 EOL 2027-04-30.** Comfortable for launch; note for the post-launch roadmap.

## Resolved versions — Phase 1 install (2026-09-07)

Installed via `npm install` on Node 24.18.0 / npm 11.16.0. `package-lock.json` committed. `npm audit` → **0 vulnerabilities** (after the postcss override).

| Package | Resolved | Notes |
| --- | --- | --- |
| `next` | **15.5.25** | latest `backport` dist-tag of the 15.5 line (`latest` is 16.3.4 — not used). `create-next-app@15.5.25`. |
| `react`, `react-dom` | **19.2.8** | pinned exact. |
| `typescript` | ^5 (5.x latest) | strict. |
| `tailwindcss`, `@tailwindcss/postcss` | ^4 | Tailwind v4, CSS-first. |
| `eslint` | ^9 | flat config; `eslint-config-next` 15.5.25. |
| `zod` | ^4.1.11 | env + money validation. |
| `pino` | ^9.6.0 | + `pino-pretty` ^13 (dev, opt-in via `LOG_PRETTY=1`). `serverExternalPackages` in `next.config.ts`. |
| `server-only` | ^0.0.1 | boundary marker. |
| `vitest` | ^3.2.4 | + `vite-tsconfig-paths` for `@/*`. |
| `@playwright/test` | ^1.56.0 | browsers installed on demand / in CI. |
| `prettier` | ^3.6.2 | — |
| `prisma` (dev) / `@prisma/client` / `@prisma/adapter-pg` | **7.10.0** (exact) | Phase 2. `prisma@latest` is `8.0.0-rc` — always pin 7. `prisma` is a devDependency; a root `prepare` script runs `prisma generate`. |
| `pg` / `@types/pg` | **8.23.0 / 8.23.1** | driver for `@prisma/adapter-pg`. |
| `embedded-postgres` (dev) | **17.10.0-beta.17** | local real PostgreSQL 17, no Docker (D-17). |
| `dotenv` (dev) | **17.2.3** | `prisma.config.ts` env loading (D-20). |
| `tsx` (dev) | **4.23.13** | runs `prisma/seed.ts` and `scripts/*.ts`. |
| **override** `postcss` / `deepmerge-ts` / `mysql2` | **8.5.28 / 8.0.2 / 3.24.3** | see `decisions.md` D-13, D-21. `npm audit --audit-level=high` → 0. |

**Not yet installed (their phases):** `@supabase/ssr` / `@supabase/supabase-js` (Phase 3), `inngest` (Phase 6), `razorpay` (Phase 7), `resend` / `@react-email/*` (Phase 10), `@sentry/nextjs` (monitoring wiring). Pins for these remain as planned above.

## Lockfile strategy

1. Phase 1 creates `package.json` with `engines`, `packageManager`, and exact (non-caret) versions for the framework/runtime-critical packages (`next`, `react`, `react-dom`, `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `@supabase/ssr`, `@supabase/supabase-js`).
2. One lockfile committed (`pnpm-lock.yaml` or `package-lock.json`). CI runs a frozen-lockfile install.
3. Renovate/Dependabot-style updates are reviewed diffs, applied as scoped commits, never auto-merged for the runtime-critical set.
4. After Phase 1 install, replace the "plan" versions above with the resolved versions and note the date.
