# The Pooja Edit + Thrift Store — Execution Playbook

Version: 1.0 · Prepared: 7 September 2026  
Stable requirements: [Master Specification / Master Prompt](01-master-specification.md)

## 1. How to use these two files

Place both files in the build repository under `docs/`, keeping their filenames. Give the AI agent both files and the phase prompt below. The master specification remains the stable source of truth; this playbook controls the work sequence. Progress, decisions, evidence and unresolved questions go in separate working records.

Begin with phase 0. Finish and verify each phase before starting the next. A phase checkpoint is an evidence review, not an invitation to redesign earlier work. Under single-phase authorization, stop after reporting that checkpoint. If the user authorizes several phases or the full sequence, continue through passed routine checkpoints automatically; pause only at an explicit approval gate, a material decision requiring user input, or a dependency that prevents truthful verification.

Do not start by generating every page. Establish database, identity, inventory and financial behavior before polishing complete commerce flows. Missing provider keys do not prevent isolated domain work, fixtures or UI work, but they do prevent claiming live integration success.

### Initial agent prompt

```text
Read docs/01-master-specification.md and docs/02-execution-playbook.md.
Treat the master specification as the stable architecture and the playbook as
execution control. Inspect the existing repository and applicable instructions.
Execute phase 0 only. Preserve existing work and identify reusable modules.
Do not create a second app, upgrade a required major version, or implement later
phases. Create the progress and decision records, verify compatibility, identify
external setup requirements, and report the phase-0 checkpoint with evidence.
Ask only for information that blocks the next authorized work.
```

### Required working records

Create and maintain these inside the implementation repository; they are not replacements for the master:

| Record | Purpose |
| --- | --- |
| `docs/build-progress.md` | Current phase; not-started/in-progress/blocked/passed; commit; tests; next task |
| `docs/decisions.md` | Small implementation decisions, dates, reasons and approved architectural changes |
| `docs/acceptance-evidence.md` | AC-01 through AC-18 mapped to test names, commands, screenshots or provider evidence |
| `docs/integration-setup.md` | Account setup, environment variable names, callback URLs, enabled test/live modes; no secrets |
| `docs/operations-runbook.md` | Deploy/migrate, schedules, replay, reconciliation, backup/restore and rollback |

Every phase report must state: delivered behavior, changed modules, verification actually run and results, acceptance IDs covered, unresolved limitations, migration/environment impact, checkpoint commit if authorized, and the exact next phase. Never report “all tests pass” if some required tests were skipped.

## 2. Shared phase rules

1. Read the master and current progress before acting. Inspect existing code, migrations, interfaces and tests before changing them.
2. List the phase's dependencies and intended changes briefly, then implement. Resolve ordinary details locally. Do not repeatedly ask permission for previously authorized work.
3. Keep business logic in domain services; reuse those services from API, admin and jobs. Preserve established contracts and migration history.
4. Add meaningful behavior tests appropriate to the phase. Use real PostgreSQL for transactions, uniqueness, locks and concurrency; SQLite and mocked Prisma cannot establish those guarantees.
5. Run the relevant checks after edits. Fix failures caused by this phase. Do not silence assertions, delete tests, or lower quality thresholds to get a pass.
6. Update records with concrete evidence, including skipped external checks. Review the diff for unrelated changes and leaked secrets. Create a focused commit if repository workflow/user authorization permits; otherwise record the reviewed diff.
7. Report the checkpoint. Continue only within the authorized phase range. Do not modify a passed phase except for a scoped dependency extension or documented bug fix with regression evidence.

### Review gates

- **Routine checkpoint:** inspect evidence against the phase requirements; continue automatically if already authorized and passed.
- **Architecture gate:** propose the exact change, reason, alternatives, compatibility/migration effects and affected acceptance tests; obtain explicit approval before changing non-negotiable architecture.
- **Destructive/production gate:** prepare the concrete deploy/migration/action, backup, rollback and verification plan. Obtain authorization if not already provided before destructive data changes, production launch, paid upgrades, real charges/refunds or customer communications.
- **Business configuration gate:** development may use clearly labelled test fixtures. Live checkout requires real owner-confirmed tax, legal, shipping/COD, returns, contact and invoice settings. Do not invent them.

## 3. Phase 0 — Inspect and freeze the implementation baseline

**Dependencies:** both documents, repository access. No provider account is needed to inspect.

**Work:** inventory the repository, preserve useful existing work, pin a compatible Next.js 15/React/Node.js 22/Prisma 7 patch set and package manager, inspect current official compatibility/security guidance, identify required environment variables, list provider setup and business inputs, and establish record files. Identify any mandated version that cannot safely deploy; propose a change instead of silently upgrading it.

**Deliverables:** compatibility/lockfile plan, module map, acceptance matrix skeleton, phase status, integration setup checklist and deferred scope list. Do not install an unrelated backend or hosting framework.

**Agent prompt:**

```text
Execute phase 0 of the playbook. Inspect and document the repository baseline,
verify the fixed stack's compatible patch versions, and create the five working
records. Separate missing business inputs from implementation choices. Identify
any conflicts with the master specification and present the smallest resolution.
Do not scaffold or replace the app until this checkpoint is complete.
```

**Checks/checkpoint:** every fixed technology accounted for; no stale Cloudinary/Auth.js/MongoDB decision retained; existing work preserved; secrets absent; live configuration blockers listed. Review the compatibility plan before scaffolding if an architecture conflict exists.

## 4. Phase 1 — Application foundation and environment isolation

**Dependencies:** phase 0 passed.

**Work:** scaffold or adapt Next.js 15 App Router with TypeScript and chosen UI/tooling; create domain folders, typed environment validation, logging/redaction, test harness, health endpoint and CI commands. Add `.env.example`, ignore rules, Node/package pins and lockfile. Separate public and server modules. Define dev/preview/prod routing and credential isolation.

**Agent prompt:**

```text
Execute phase 1 only using the accepted baseline. Establish a working Next.js 15
app, fixed runtime/tooling, environment validation, server-only boundaries, logging,
CI checks and test harness. Reuse existing foundations. Add a minimal accessible
shell; do not simulate checkout or connect previews to production services.
```

**Checks:** clean install, lint, type check, unit smoke test, production build; missing required configuration yields a useful error; browser bundles contain no secrets; preview cannot resolve live credentials by fallback. Commit foundation checkpoint. Covers part of AC-17.

## 5. Phase 2 — Database, migrations, Prisma and business schema

**Dependencies:** phase 1; isolated local/dev PostgreSQL or Supabase. Production database access is unnecessary.

**Work:** configure Prisma 7 CLI and runtime adapter, transaction/session connections, pool limits and explicit environment loading. Implement master models, indexes, foreign keys, exact money representation and SQL constraints. Create safe dev seed with new apparel variants, one thrift piece, sold thrift and mixed-order fixtures. Version Storage/RLS/grant ownership setup. Never migrate Supabase-managed tables as commerce models.

**Agent prompt:**

```text
Execute phase 2. Implement the master's logical schema with Prisma 7 and reviewed
SQL constraints. Prove both runtime pooling and CLI migration connections. Create
reproducible development migrations and a nonproduction seed. Test uniqueness,
stock bounds, relation integrity and snapshot retention. Do not use production
reset/db push, edit applied migrations, or turn failed constraints into UI checks.
```

**Checks:** generate/validate client, migrate an empty database, migrate an existing fixture database, seed twice safely, use Prisma Studio through the CLI connection, exercise runtime concurrent reads/writes, reject invalid stock/duplicate identifiers, inspect SQL. Check that catalog/slug scope and nullable category uniqueness behave correctly. Covers AC-01/11/17 foundations.

**Checkpoint:** schema/relations and migration diff review. An approved schema is extended later through additive migrations, not regenerated from scratch.

## 6. Phase 3 — Authentication, authorization and asset storage

**Dependencies:** phase 2; Supabase dev Auth/Storage configuration.

**Work:** customer sign-up/login/logout/reset/callback, server identity verification, Next.js 15 cookie refresh, lazy customer creation by auth ID, owner bootstrap, active admin/role guards, account ownership checks, guest access-token service. Implement signed admin uploads, metadata confirmation, public product bucket and private document bucket. Lock down commerce Data API access.

**Agent prompt:**

```text
Execute phase 3. Implement Supabase Auth and server-enforced customer/admin guards,
secure guest-order access primitives, and signed product uploads/private documents.
Never claim guest history by matching unverified contact details. Test revoked or
inactive admins, direct action/API calls, cross-customer access and Storage/Data API
policies. Use the existing schema and services; add only necessary migrations.
```

**Checks:** unauthenticated, ordinary customer, inactive admin, valid admin; altered cookies/tokens; cross-account reads; expired/revoked guest tokens; malicious file types/paths; unauthorized uploads/document downloads; anonymous Data API reads/writes denied. Covers AC-03/12 foundations.

**Checkpoint:** security evidence review before adding sensitive admin mutations. Development bootstrap must not create a public privilege-escalation route.

## 7. Phase 4 — Product administration and dual storefronts

**Dependencies:** phase 3.

**Work:** admin product/variant/category/collection/image CRUD, publication validation and audited changes; public homepage, separate listings/PDPs/collections, search/filter pagination, navigation and mixed persisted cart. Implement thrift-specific fields, sold-page behavior, metadata, structured data and images. Establish accessible responsive UI tokens without copying a generic dashboard into the storefront.

**Agent prompt:**

```text
Execute phase 4. Build functional catalog administration and both storefronts from
persisted data. Apply catalog scope to every query and collection. Implement thrift
publication validation, sold URLs, variant selection and a mixed cart. Cart stock
and prices remain advisory and adding to cart must never reserve stock. Add SEO,
responsive images, keyboard interaction and complete empty/error states.
```

**Checks:** same slug in two catalogs resolves correctly; cross-catalog memberships rejected; drafts hidden; sold thrift unavailable but readable; acquisition costs absent from public payloads; cart survives reload and labels catalogs; mobile 360px and desktop review; keyboard navigation and no overflow. Covers AC-01/02 and part of AC-16.

**Checkpoint:** storefront/admin visual and functional review. Confirm brand content and product information; use clearly labelled fixtures until real assets are provided.

## 8. Phase 5 — Pricing, tax, inventory and checkout core

**Dependencies:** phases 2–4. Shipping can use a typed test adapter until phase 8, visibly restricted to development.

**Work:** exact pricing/tax calculator, quote expiry, immutable order/address/policy snapshots, idempotent checkout, atomic all-item reservations, stock ledger, expiry/release/conversion services, late-capture handling contract, COD stock allocation/confirmation/cancellation, refund/restock boundaries and guest order access. Provider calls remain outside transactions. Implement service-level expiry execution now; schedule it in phase 6.

**Agent prompt:**

```text
Execute phase 5. Build authoritative checkout, standard configurable GST snapshots,
integer-paise totals, atomic reservations and COD allocation exactly as specified.
Use real PostgreSQL concurrency tests and deterministic race orchestration. Prove
all-or-nothing mixed-cart reservations and idempotent lifecycle transitions. A
provider test adapter may exercise contracts but must not appear as real payment.
```

**Mandatory tests:** two or more independent connections contend for one thrift item and exactly one succeeds; failure on the final mixed-cart item rolls back all earlier allocations; duplicate checkout returns one order; mismatched idempotency payload rejected; expiry versus conversion races; repeated release/cancel; negative quantities; forged totals; inclusive tax extraction and component rounding; price change; COD cancellation restores once; late capture after stock is reallocated prevents fulfillment.

**Checkpoint:** financial/inventory evidence review. No payment UI is considered complete before these tests pass. Covers AC-04/05/08/09/11 foundations.

## 9. Phase 6 — Durable event delivery and scheduled recovery

**Dependencies:** phase 5; Inngest development setup.

**Work:** transactional DomainEvent/outbox producer, webhook inbox abstraction, bounded lease-based dispatcher, Inngest endpoint, independently retryable consumers, persistent execution keys, operational task service and authenticated replay. Deploy reservation sweep and outbox recovery schedule. Add reconciliation job interfaces for later providers.

**Agent prompt:**

```text
Execute phase 6. Implement the transactional outbox and Inngest delivery pipeline
with leased claims, durable consumer deduplication, retry exhaustion and operational
tasks. Demonstrate crash recovery before send, after send before marking dispatch,
and during consumer execution. Install and verify actual recurring expiry/dispatch
jobs; never rely on a request process staying alive after the response.
```

**Checks:** committed domain event survives dispatcher outage; duplicate send does not duplicate local effects; stale lease recovered; successful steps not needlessly replayed; exhausted jobs surface once; replay is authorized/audited; expired reservations released while storefront is idle. Test remote-unknown outcome strategy using an adapter fixture. Covers AC-07/10.

**Checkpoint:** document schedule ownership, retry settings, stale-job thresholds and manual recovery in runbook.

## 10. Phase 7 — Razorpay and end-to-end prepaid/COD checkout

**Dependencies:** phases 5–6; Razorpay test account/configuration.

**Work:** Razorpay provider adapter and Cashfree-ready interface, server order creation, checkout UI, raw-body verified webhooks, captured-payment verification, refunds/reconciliation primitives and payment timeline. Connect guest order confirmation and account views. COD remains distinct from prepaid.

**Agent prompt:**

```text
Execute phase 7. Implement Razorpay test-mode checkout using the existing order,
inventory and outbox services. Verify server-known order, payment, amount, currency
and captured state. Persist webhooks before acknowledgment and reconcile ambiguous
results. Handle retries, multiple payment attempts, late capture and excess captures.
Keep Cashfree unimplemented behind the provider interface and label it disabled.
```

**Checks:** legitimate provider test payment; forged browser success; invalid signature; wrong order/amount/currency; authorized but not captured; duplicate/stale events; failure after provider creation; payment captured after reservation expiry; duplicate captured attempts; pending-payment UI/recovery; COD never shown as prepaid. Include local deterministic fixtures plus provider test evidence. Covers AC-03/06/07/08/09.

**Checkpoint:** real Razorpay test-mode evidence required before marking the phase fully passed. No real customer charge or refund without authorization.

## 11. Phase 8 — Shiprocket and shipping operations

**Dependencies:** phases 6–7; Shiprocket credentials and provider-supported testing arrangement, actual shipping configuration for live readiness.

**Work:** serviceability and shipping quote adapter, replace dev checkout quote fixture, create/reconcile shipment, courier/AWB, label, tracking normalization, callback verification, polling reconciliation, NDR/RTO operational tasks, COD collection/remittance records and audited overrides. Keep one-shipment UI initially while preserving ShipmentItem schema.

**Agent prompt:**

```text
Execute phase 8. Connect Shiprocket through the existing fulfillment services and
outbox. Validate checkout serviceability and shipping prices on the server. Make
shipment creation safe across retries and unknown outcomes. Verify the provider's
actual webhook security mechanism, normalize tracking without stale regressions,
and handle NDR, inspected RTO restock and COD remittance separately.
```

**Checks:** nonserviceable postcode; COD disallowed; provider timeout before/after creation; repeated shipment request does not duplicate shipment; authenticated/invalid callbacks; out-of-order tracking; NDR repeated events; RTO-in-transit does not restock; inspected RTO restocks once; private label access; COD collection differs from remittance.

**Checkpoint:** confirm the available test mode from official provider/account information; do not assume a sandbox exists. If only live operations are available, prepare a controlled test for authorization. Mock-only evidence leaves AC-13 blocked. Covers AC-09/13.

## 12. Phase 9 — Invoices, refunds and returns

**Dependencies:** phases 7–8; owner-confirmed configuration required for live invoice correctness, labelled fixtures sufficient for development.

**Work:** financial-year sequence allocation, standard-GST invoice snapshots/PDF generation/private access, credit notes, partial/full refunds with concurrent amount limits, provider refund reconciliation, return quantities/inspection and explicitly authorized restock. Keep prior invoices immutable.

**Agent prompt:**

```text
Execute phase 9. Implement invoices, credit-note records, refunds and return
inspection on the existing snapshots and payment/inventory services. Preserve
STANDARD GST and leave margin treatment disabled. Enforce refund limits including
pending requests, allocate invoice numbers atomically and make document jobs
repeatable. Never infer physical restock from refund completion alone.
```

**Checks:** simultaneous invoice creation produces one identity; retries reuse it; financial-year boundary; exact tax totals; product/tax edits do not alter old invoices; unauthorized PDF denied; partial refunds sum correctly; concurrent over-refunds blocked; unknown refund outcome reconciled; duplicate inspection cannot restock twice. Render and visually inspect representative new/thrift/mixed invoice PDFs. Covers AC-05/07/11/12.

**Checkpoint:** owner reviews business/tax fields and invoice samples before live issuance. The agent does not invent rates, GSTIN or legal policy.

## 13. Phase 10 — Notifications and delivery observability

**Dependencies:** phase 6 plus order/payment/shipping events; dev recipients and provider configuration.

**Work:** versioned React Email and WhatsApp template registry, validated variables, channel eligibility/consent, Resend and Meta adapters, in-app notifications, delivery callbacks, per-delivery deduplication, retries and failure tasks. SMS stays disabled. Separate confirmation, shipping, delivery, cancellation and refund wording; no COD “payment successful” message.

**Agent prompt:**

```text
Execute phase 10. Implement the master's notification event/channel matrix with
versioned templates, consent checks, durable delivery identities, verified callbacks
and audited replay. Use test recipients only. Make channel failure independent of
order/payment state. Do not claim WhatsApp delivery from mere API acceptance or
send duplicate confirmations for multiple events representing the same transition.
```

**Checks:** missing email/consent does not break checkout; provider outage preserves paid order; duplicate event does not duplicate logical delivery; stale callback cannot undo delivered state; template variables validated; failures observable; replay safe; test email rendering and approved WhatsApp template delivery demonstrated. Covers AC-07/10/14.

**Checkpoint:** template/wording review and test-recipient evidence. Required unconfigured channels remain explicit launch blockers.

## 14. Phase 11 — Complete the operator dashboard

**Dependencies:** phases 4–10; reuse the admin shell and domain services already built.

**Work:** operational overview, Needs Attention queue, full order detail timeline, shipping/NDR/RTO views, refunds/returns, inventory ledger, customer notes, analytics by catalog/payment type, COD reconciliation, notification/job retry screens, activity log and nonsecret settings. Add bounded bulk actions with partial results and visibility-aware polling.

**Agent prompt:**

```text
Execute phase 11. Complete the solo-operator dashboard by composing existing domain
services. Do not implement alternate payment, inventory or shipment logic in UI
actions. Support searching/filtering/pagination, contextual guarded actions, reasons,
audit history and deduplicated operational tasks. Separate placed sales, captured
revenue, refunds and COD remittance in analytics.
```

**Checks:** operator completes a prepaid and COD lifecycle; NDR/failed refund/job cases appear and resolve; bulk actions report per-record failures; inactive admin denied; pagination stable; mixed-order revenue allocated by line; cost data restricted; UI poll/backoff behavior. Covers AC-12/15.

**Checkpoint:** run an operator walkthrough with concrete fixtures and record remaining usability issues. No unrestricted “set status” control may bypass lifecycle rules.

## 15. Phase 12 — Full-system verification and preview readiness

**Dependencies:** all implementation phases; isolated Vercel preview and test integrations.

**Work:** regression suite, abuse/access checks, mobile accessibility, metadata, cache isolation, image performance, connection/resource load test, dependency review, failure recovery drills and migration rehearsal. Deploy preview using dev/test services. Populate all AC evidence entries and fix defects without broad rewrites.

**Agent prompt:**

```text
Execute phase 12. Verify AC-01 through AC-18 against the integrated application.
Run real PostgreSQL race tests, browser prepaid/COD/guest/admin journeys and provider
test evidence. Check private caching, direct API authorization, mobile usability,
SEO, outbox recovery and connection limits. Fix failures narrowly with regressions.
Produce a release candidate and explicit blocker list; do not call it production
ready while required evidence or configuration is missing.
```

**Minimum automated suite:** lint/type/build; unit pricing/state transitions; PostgreSQL migrations/constraints/races; Playwright guest mixed-cart, authenticated account isolation, sold thrift, prepaid/COD, admin order operation and invalid access. Test browser return before webhook and webhook before browser return.

**Manual checks:** 360px mobile and desktop, keyboard checkout, error/retry states, invoice visual review, provider dashboards vs local records, idle scheduler operation, secrets/PII in logs and browser payloads, preview isolation.

**Performance targets:** use LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 as intended field targets. Before traffic exists, record repeatable lab results and remaining uncertainty rather than claiming measured field performance. Verify catalog pagination, image weights, database connection ceilings and failure under capacity pressure. Do not add a paid cache service or switch hosting silently.

**Checkpoint:** release candidate evidence review; no unresolved critical security, overselling, money, migration or data-loss defect. AC-18 operational work continues in phase 13.

## 16. Phase 13 — Operational handover and authorized production launch

**Dependencies:** passed release candidate, real business settings, configured provider accounts, production authorization.

**Work before requesting launch approval:** prepare the exact deployment and reviewed migrations; verify environment separation; capture restorable database/assets backup; demonstrate restore in isolation; document rollback and compensating migration; verify provider callbacks, Inngest schedules, alerts, quotas/charges, credential ownership, policy pages, admin access and customer support details. Enumerate any external action needing authorization.

**Agent prompt:**

```text
Execute phase 13 preparation. Complete the runbook, backup/restore exercise, release
checklist and concrete deployment plan. Verify live configuration without exposing
secrets. Report remaining blockers and request production authorization only if it
has not already been given. Once authorized, deploy the reviewed artifact, apply
reviewed migrations through the release workflow, verify callbacks/schedules and
run the authorized smoke test. Record actual results and rollback readiness.
```

**Launch checklist:**

- [ ] AC-01–AC-18 each has passed evidence, or an explicitly approved noncritical limitation; critical invariants cannot be waived implicitly.
- [ ] GSTIN, legal address/name, supplier state, HSN/rates, invoice series, tax/fee rules and policies confirmed.
- [ ] Razorpay live configuration/capture behavior and callbacks validated; Cashfree remains disabled.
- [ ] Shiprocket pickup/serviceability/COD/label/tracking setup validated.
- [ ] WhatsApp approved templates/consent and email sender configured; real customer messaging authorized.
- [ ] Supabase Free resource allowances, pause behavior, backup capability and capacity thresholds documented from current account information.
- [ ] Vercel and Inngest environment limits/schedules verified; no assumed in-process background jobs.
- [ ] Auth redirect URLs, active owner, Data API restrictions, Storage policies and private download guards verified.
- [ ] Backup restore demonstrated; rollback plan accounts for compatible database changes and external transactions already committed.
- [ ] Alerts cover failed payments/reconciliation, stale outbox, reservation expiry, failed shipment/refund, invoice failures and capacity.
- [ ] Authorized smoke transaction reconciled across provider, order, inventory, invoice and notifications; any refund/restock is separately correct.
- [ ] Runbook explains daily Needs Attention, pending COD, payment discrepancies, remittance and return-inspection workflow.

**Checkpoint:** record release commit, environment, migration status, smoke evidence, limitations and operator handover. Do not promise unattended monitoring unless it has actually been configured.

## 17. Resuming, fixing defects, and changing architecture

### Resume prompt

```text
Read both specification files and docs/build-progress.md, docs/decisions.md and
docs/acceptance-evidence.md. Inspect the latest diff and existing tests. Resume the
first incomplete task in the currently authorized phase. Preserve all passed
architecture and contracts. Run only the checks needed for the resumed work and
its affected dependencies; update evidence and report the next checkpoint.
```

### Scoped defect prompt

```text
Investigate the reported defect against the master specification and reproduce it.
Identify the owning service and affected acceptance criteria. Add a regression test
where meaningful, implement the smallest correct fix, and run affected checks.
Do not rebuild completed modules or change the stack. If a schema change is needed,
add a reviewed migration without editing history. Report cause, fix, test evidence
and any deployment or data-repair impact.
```

### Architectural change procedure

Write an entry with the proposed exact change, why existing architecture cannot meet the need, alternatives, affected contracts/acceptance IDs, migration/backfill, compatibility, rollback and tests. Obtain approval before changing a non-negotiable. Then update the master once, increment its version, link the decision, and adjust only affected playbook steps. Do not use a task-status edit to smuggle in an architectural change.

### Migration and test discipline

Prefer expand → backfill → validate → switch → later contract for production changes. Run destructive migration experiments only on disposable databases. Never roll back application code against an incompatible schema without a tested plan. External charges, refunds and shipments are not undone by restoring a database; reconcile them explicitly.

Fix newly exposed foundational defects even if their original phase passed, but preserve the surrounding design. A narrow regression reopening is preferable to silently accepting broken invariants. Record skipped provider tests as blocked, not passed. Complete the work already authorized before asking the owner to review a concrete result.
