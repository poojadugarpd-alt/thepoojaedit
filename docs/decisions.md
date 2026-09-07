# Decisions Log

Small implementation decisions (with date + reason) and any approved architectural changes. Architectural non-negotiables from the master specification are **not** changed here without the change-proposal procedure in playbook §17.

## Confirmed (carried from the master specification — recorded so no stale alternative resurfaces)

| ID | Decision | Date | Reason |
| --- | --- | --- | --- |
| D-1 | Identity: **Supabase Auth** (with `@supabase/ssr` + `@supabase/supabase-js`). **Not** Auth.js/NextAuth. | 2026-09-07 | Master §1 latest-approved decision. No prior code holds a different choice. |
| D-2 | File storage: **Supabase Storage** (public `product-images`, private buckets for invoices/labels/documents). **Not** Cloudinary. | 2026-09-07 | Master §1 / §9. |
| D-3 | Database: **PostgreSQL** (Supabase Free). **Not** MongoDB. | 2026-09-07 | Master §1 / §2. |
| D-4 | ORM: **Prisma 7** with `@prisma/adapter-pg` + `pg` driver adapter; CLI datasource in `prisma.config.ts`. | 2026-09-07 | Master §2 / §3. Verified in Phase 0 that Prisma 7 is stable + production-recommended (see `compatibility-plan.md`). |
| D-5 | Framework: **Next.js 15 App Router** (15.5.x), React 19.2.x, Node 22 LTS on Vercel. | 2026-09-07 | Master §2. Phase 0 confirmed 15.5.x is still security-supported (Maintenance LTS). |
| D-6 | Single application, single commerce database, shared cart/checkout/order/payment/shipping/invoice/admin systems across both catalogs (`THE_POOJA_EDIT`, `THRIFT`). No independent per-catalog backends. | 2026-09-07 | Master §2 / §4. |
| D-7 | Tax: **STANDARD configurable GST** treatment only for now. `SECOND_HAND_MARGIN` reserved in schema/strategy but **disabled** in checkout; never inferred from acquisition cost. | 2026-09-07 | Master §6. |

## Phase 0 implementation decisions

| ID | Decision | Date | Reason |
| --- | --- | --- | --- |
| D-8 | Package manager: **npm** (`package-lock.json`, `packageManager: "npm@11.16.0"`). *Changed from the planned pnpm.* | 2026-09-07 | Corepack could not put a `pnpm` shim on PATH in this environment without extra privileges. npm 11 is already present, works, and Vercel supports it. Not an architecture choice; can revisit later with zero code impact. |
| D-9 | Tailwind CSS **v4** confirmed working — `create-next-app@15.5.25` scaffolds it (CSS-first `@import "tailwindcss"` + `@theme`), build + `sr-only` utilities verified. shadcn/ui CLI init deferred to the first phase that needs a component (Phase 4). | 2026-09-07 | Current supported default for Next 15 + React 19; no v3 fallback needed. |
| D-13 | **`overrides: { "postcss": "8.5.28" }`** in `package.json`. | 2026-09-07 | `create-next-app` pulled a `postcss` nested under `next` that `npm audit` flagged high (GHSA-qx2v-qp2m-jg93 + sourceMappingURL path-traversal chain, all fixed in 8.5.23+). The advisory's own "fix" bumps to Next 16, which the spec forbids. Forcing postcss to the patched 8.5.28 across the tree clears the finding (`npm audit` → 0) while staying on Next 15.5.25. Revisit/remove when Next 15.5.x ships a bundled postcss ≥ 8.5.23. |
| D-14 | **`APP_ENV` is derived from `NEXT_PUBLIC_APP_ENV` → `VERCEL_ENV` → `"development"`; `NODE_ENV` is deliberately ignored.** | 2026-09-07 | `next build` always sets `NODE_ENV=production`, so keying off it made every local/CI build look like the production *deployment* and trip the production env gate. Deployment identity ≠ build mode. Only a Vercel production deploy (`VERCEL_ENV=production`) or an explicit override is "production". Implemented in `src/lib/app-env.ts`, unit-tested. |
| D-15 | Vitest aliases **`server-only` / `client-only` to an empty stub** (`src/test/empty-module.ts`). | 2026-09-07 | Vitest does not set the `react-server` export condition, so importing the real `server-only` package throws. Aliasing is the standard workaround and does not weaken the boundary (the build still enforces it; verified no `pino`/server-only marker reaches `.next/static`). |
| D-16 | `engines.node` is `"22.x"` (not a hard `<23` ceiling); `.nvmrc` = `22`. Local dev on Node 24 works with one `EBADENGINE` warning. | 2026-09-07 | Vercel honours `22.x`; the warning is cosmetic. A strict ceiling would block the user's current machine for no real benefit. |
| D-10 | Spec files live at `docs/01-master-specification.md` and `docs/02-execution-playbook.md` inside the build repo, filenames preserved. Originals remain at `~/Documents/`. | 2026-09-07 | Playbook §1 instruction. |
| D-11 | Working records created as separate files under `docs/`: `build-progress.md`, `decisions.md`, `acceptance-evidence.md`, `integration-setup.md`, `operations-runbook.md`, plus Phase 0 deliverables `compatibility-plan.md`, `module-map.md`, `deferred-scope.md`. | 2026-09-07 | Playbook §1 required working records + Phase 0 deliverables. |
| D-12 | Exact runtime-critical package versions are pinned (non-caret) in Phase 1 and the resolved values written back into `compatibility-plan.md`. Phase 0 records the plan only; no `package.json` created yet. | 2026-09-07 | Playbook Phase 0: "Do not scaffold or replace the app until this checkpoint is complete." |

## Phase 2 implementation decisions

| ID | Decision | Date | Reason |
| --- | --- | --- | --- |
| D-17 | **Local dev/test database = `embedded-postgres`** (real PostgreSQL 17, `npm run db:dev`, data in `.pgdata/`). Pinned `embedded-postgres@17.10.0-beta.17` (this package only ever publishes `-beta.N` tags — it is the maintainer's release channel over real `zonkyio` PostgreSQL binaries). Production is unchanged (Supabase). CI uses a `postgres:17` service container instead. | 2026-09-07 | This machine has no Docker, no Homebrew, no local Postgres, and Supabase CLI needs Docker. `embedded-postgres` is the only no-account/no-admin way to get a *real* Postgres, which the playbook mandates for transaction/lock/concurrency tests. Resolves D-open-3 for Phase 2. |
| D-18 | **Prisma 7 config shape.** Schema `datasource` block has `provider` only — Prisma 7 removed `url` and `directUrl` from the schema. CLI URL lives in `prisma.config.ts` (`datasource.url = DIRECT_URL ?? DATABASE_URL`, env loaded explicitly via `dotenv`). Runtime client is built with `@prisma/adapter-pg` in `src/lib/db.ts`. Generator = `prisma-client-js` with custom `output = ../src/generated/prisma` (well-understood, adapter-compatible; the new `prisma-client` generator is an additive change if wanted later). | 2026-09-07 | Forced by Prisma 7's API (`prisma validate` rejects `url` in schema). Matches master §3 intent. |
| D-19 | **Companion SQL migration `manual_constraints`** carries every guard Prisma can't express: non-negative money/stock + `reservedQty ≤ onHandQty` CHECKs; positive line/movement quantities; the **order totals identity** as a CHECK; **two partial unique indexes** for Category shared-slug uniqueness (`WHERE catalog IS NOT NULL` / `WHERE catalog IS NULL`) — an `enum::text` COALESCE index expression is not IMMUTABLE and was rejected; a `BEFORE INSERT/UPDATE` trigger for the **thrift one-of-one** on-hand ≤ 1 limit. Later migrations extend, never rewrite. | 2026-09-07 | Master §5 "Required constraints" + "Enforce thrift physical-piece limits in database-backed operations, including admin edits". |
| D-20 | **`dotenv`** added as a devDependency solely so `prisma.config.ts` can load `.env.local` then `.env` for the CLI (Prisma 7 no longer auto-loads). | 2026-09-07 | Master §3: "Explicitly load environment variables for the Prisma CLI." |
| D-21 | **`overrides` extended** with `deepmerge-ts` 8.0.2 and `mysql2` 3.24.3. | 2026-09-07 | The `prisma` CLI's own dep tree pulled `deepmerge-ts <8` (via `@prisma/config`) and `mysql2 <=3.23.0` — both high-severity, both dead code for us (no MySQL, no untrusted config merge). `npm audit`'s "fix" was a downgrade to Prisma 6 (forbidden). Overrides force the patched releases; `npm audit --audit-level=high` → 0. `prisma` CLI verified working (validate/migrate/generate/studio). Also moved `prisma` to `devDependencies`; added a root `prepare` script running `prisma generate`. |
| D-22 | Schema conventions: UUIDv7 ids (`@default(uuid(7)) @db.Uuid`), all money `Int` paise, all rates `Int` basis points, all timestamps `@db.Timestamptz(6)`. Financial-history relations use `onDelete: Restrict`; products are archived not deleted. `@@id`/`@@unique`/`@@index` per master §5 "Index at least". | 2026-09-07 | Master §5 "behavioral schema contract". |

## Phase 3 implementation decisions

| ID | Decision | Date | Reason |
| --- | --- | --- | --- |
| D-23 | **Phase 3 built as a local slice; live Supabase security evidence deferred.** One seam — `src/server/auth/identity.ts` `getVerifiedIdentity()` — calls `supabase.auth.getUser()`; everything else (customer upsert, admin/role/ownership guards, owner bootstrap, guest access tokens, image-upload validation) takes `db`/inputs as args and is tested against embedded PostgreSQL. When Supabase isn't configured, the seam returns `null` and the middleware/clients no-op. | 2026-09-07 | Playbook: "Missing provider keys do not prevent isolated domain work … but they do prevent claiming live integration success." Keeps momentum without faking the security checkpoint. |
| D-24 | **Owner bootstrap is double-gated**: secret `ADMIN_BOOTSTRAP_TOKEN` **and** zero-active-admins; refuses once any active admin exists. | 2026-09-07 | Playbook Phase 3 checkpoint: "Development bootstrap must not create a public privilege-escalation route." |
| D-25 | **Guest order access** = expiring high-entropy token, SHA-256 hash stored (never plaintext), generic `ResourceNotFoundError` on every failure mode (wrong token / scope / order / expired / revoked). Order number is never accepted in place of a token. Contact matches never link orders. | 2026-09-07 | Master §9. |
| D-26 | **Storage behind a `StoragePort` interface** (`src/lib/storage.ts`); image paths are **server-derived** from `(catalog, productId, imageId)` and re-checked on confirm (mismatch → reject) to prevent path takeover. `createSupabaseStoragePort()` is the live impl; tests use a fake. | 2026-09-07 | Master §9 "Issue short-lived signed upload URLs for server-selected paths … Prevent path takeover". |
| D-27 | **Data API lockdown SQL** (`supabase/policies/01_…`) revokes from `anon`, `authenticated` **and `public`** (PostgreSQL grants to `public` by default, so revoking from `anon` alone is a no-op — carried from a sibling project), then `ENABLE` (not `FORCE`) RLS with no policies. `FORCE` would apply RLS to the table owner and break every Prisma query. | 2026-09-07 | Master §9; verified-gotcha from prior Supabase work. |
| D-28 | Supabase packages: `@supabase/ssr@0.12.6`, `@supabase/supabase-js@2.115.0` (exact). | 2026-09-07 | Master §2. |

## Phase 4 implementation decisions

| ID | Decision | Date | Reason |
| --- | --- | --- | --- |
| D-29 | **Legacy-content extraction (89 dm2buy + 27 thepoojaedit) is the Phase 4 dev dataset.** `migration/scripts/import-to-dev-db.mjs` loads `products.json` into the dev DB as migration-draft content (hidden `__legacy_import` collection per catalog), NOT production. Thrift products collapse to one physical variant (`onHandQty` 0/1 from the source), deterministic SKUs generated (no SKUs in either source), condition defaults to `GOOD` + a "needs review" note. | 2026-09-07 | Playbook Phase 4: "use clearly labelled fixtures until real assets are provided" — real extracted content is better than invented fixtures and exercises the storefront properly. |
| D-30 | **`/legacy-media/[...key]` dev-only route** streams the downloaded image files from `migration/legacy-content/images/` (guarded `if (isProduction) 404`). The importer sets `ProductImage.publicUrl` to `/legacy-media/…` when a local file exists. | 2026-09-07 | Several legacy CDN objects 500 the Next image optimizer; copying ~500 MB into `public/` is worse. Production images come from Supabase Storage. `next.config.ts` still allows the three CDN hosts as a fallback. |
| D-31 | **`src/lib/catalog-routes.ts`** holds the client-safe catalog↔segment mapping (no `server-only`, no DB); `src/server/catalog/index.ts` re-exports it. Storefront client components (`product-card`, `add-to-cart`, `cart-*`) import from there. | 2026-09-07 | `src/server/catalog` is `server-only`; client components needed the mapping. |
| D-32 | **Public availability is derived, three-valued**: `IN_STOCK` / `OUT_OF_STOCK` / `SOLD`. `SOLD` only for a one-of-one THRIFT piece with nothing available (permanent); ordinary apparel with 0 stock is `OUT_OF_STOCK` (restockable). Publication status and availability are separate (master §4). | 2026-09-07 | Master §4 / AC-02. |
| D-33 | **Cart = Zustand + `persist` (localStorage `pe-cart-v1`)**. Lines hold `{variantId, catalog, slug, title, variantLabel, unitPricePaise, quantity, imageUrl, returnPolicyNote}`. Prices/stock are advisory snapshots; the server revalidates at checkout; adding never reserves stock; one-of-one lines cap at qty 1. `groupByCatalog` is a plain helper (not a store selector) to avoid `useSyncExternalStore` re-render loops. | 2026-09-07 | Master §4. |
| D-34 | **`/checkout` is an explicit "not open yet" placeholder** — deliberately no simulated checkout (playbook Phase 4: "do not simulate checkout"). Real checkout is Phase 5. | 2026-09-07 | Playbook. |

## Open items / proposals (not yet decided)

| ID | Item | Status |
| --- | --- | --- |
| D-open-1 | **Next.js 16 vs 15.** Master mandates 15; Next 16 is now Active LTS while 15.5.x is Maintenance LTS (still security-patched). Launching on 15.5.x is acceptable. If the Maintenance window threatens the launch/support horizon, raise an **architecture gate** proposal (compatibility, migration effort, affected ACs) before moving. | Watch — no action now |
| D-open-2 | ~~pnpm vs npm~~ — resolved as npm (D-8). | Closed 2026-09-07 |
| D-open-3 | Dev database choice. **Phase 2: resolved → `embedded-postgres` (D-17).** Phase 3 revisits for Auth/Storage — local Supabase CLI needs Docker (absent here), so a free hosted Supabase dev project is the likely path. | Phase 2 closed; Phase 3 reopens for Supabase specifically |
| D-open-4 | Supavisor transaction-pooler + Prisma 7 adapter concurrency proof (master §3) — cannot run without a Supabase project. | Blocked until Phase 3 Supabase project exists |

## Architectural change procedure (reference)

Per playbook §17: write the exact proposed change, why the current architecture can't meet the need, alternatives, affected contracts/AC IDs, migration/backfill, compatibility, rollback, tests. Get explicit approval. Then update the master once, bump its version, link the decision here, adjust only affected playbook steps. A task-status edit must never smuggle in an architecture change.
