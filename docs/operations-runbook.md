# Operations Runbook

Deploy/migrate procedures, schedules, replay, reconciliation, backup/restore, and rollback. **Skeleton at Phase 0** — sections are filled by the phase that introduces the capability (noted per section). Nothing operational exists yet.

## 1. Environments

| Environment | Database | Payments | Purpose | Status |
| --- | --- | --- | --- | --- |
| Local dev | Local Postgres / local Supabase / Supabase dev project | Razorpay test | Development, integration tests | Not set up |
| Vercel Preview | Supabase **dev** project | Razorpay test | PR previews — **never** prod data or live credentials | Not set up |
| Production | Supabase **prod** project | Razorpay live | Live store | Not set up |

Environment identity is shown visibly in the admin UI (master §3). Preview must not resolve live credentials by fallback.

## 2. Deploy & migrate _(release flow finalized Phase 13)_

**Local dev**
- `npm run db:dev` — start embedded PostgreSQL 17 (`.pgdata/`, port 5433), creates `poojaedit_dev` + `poojaedit_shadow`, prints the `.env.local` URLs. Keep running in its own terminal.
- `npm run db:migrate` — `prisma migrate dev` (dev DB only).
- `npm run db:seed` — idempotent fixtures.
- `npm run db:studio` — Prisma Studio.
- `npm run db:reset` — drop + re-migrate + re-seed the dev DB.

**CI** — `integration` job runs a `postgres:17` service; `INTEGRATION_DATABASE_URL` points the suite at it; `tests/integration/global-setup.ts` drops/creates a fresh DB and runs `prisma migrate deploy` before the suite.

**Production (from Phase 13)**
- Build/deploy: Vercel, Node 22 runtime, frozen-lockfile install (`npm ci` → `prepare` runs `prisma generate`).
- Migrations: `prisma migrate deploy` through the release workflow only. **Never** `migrate reset` / `db push` / edit an applied migration against a shared or prod database.
- Migration policy for production changes: expand → backfill → validate → switch → later contract. Additive only over the approved Phase 2 schema (`init` + `manual_constraints`).
- The `manual_constraints` migration holds CHECKs, partial unique indexes and the thrift one-of-one trigger — later migrations extend these, never drop-and-recreate.

## 3. Scheduled / recurring jobs _(filled Phase 6)_

Required recurring work (master §8): reservation expiry sweep · outbox dispatch + recovery · payment reconciliation · shipment reconciliation · stale/failed operation alerts. All run as real deployed Inngest schedules — **no** reliance on Vercel request lifetime or in-process timers.

Wiring: `src/inngest/functions.ts` (job definitions) served at `src/app/api/inngest/route.ts` (`GET/POST/PUT`, `runtime = "nodejs"`, request-signature verified when `INNGEST_SIGNING_KEY` is set). Job bodies are plain, testable functions in `src/server/events/` and `src/server/inventory/` — the Inngest function is only a scheduler + retry wrapper. Register the deployment's `/api/inngest` URL in the Inngest dashboard (or run `npx inngest-cli dev` locally) for the crons to fire.

| Job (Inngest id) | Schedule | Body | Concurrency | Retry / lease | Thresholds |
| --- | --- | --- | --- | --- | --- |
| `dispatch-outbox` | `* * * * *` (every 1 min) | `dispatchPending(prisma, { transport: inngestTransport, owner: "cron:dispatch-outbox" })` | 1 (no overlap) | Per outbox event: **8** attempts (`DEFAULTS.maxAttempts`), full-jitter exponential backoff `base 2 s · 2^(n-1)`, capped **5 min**. Claim lease **30 s** (`DEFAULTS.leaseMs`); batch **50** (`DEFAULTS.batchLimit`, hard cap 200). On attempt 8 → outbox `FAILED` + one `OperationalTask` `outbox:<id>` (`JOB_FAILURE`, priority 1). | — |
| `sweep-reservations` | `*/2 * * * *` (every 2 min) | `runReservationSweep(prisma)` → `expireReservations` in one tx, `FOR UPDATE SKIP LOCKED` | 1 | Inngest step default (idempotent — re-run only releases newly-expired rows) | Releases reservations with `expiresAt <= now`; batch 100 default |
| `outbox-health` | `*/10 * * * *` (every 10 min) | `runStaleOutboxAlert(prisma)` | 1 | — | Alerts when any outbox event is `FAILED`, or `DISPATCHING` with `leaseExpiresAt` older than **10 min** (`stuckAfterMs`). Raises/refreshes one `OperationalTask` `outbox:health` (`JOB_FAILURE`, priority 2). |
| `on-outbox-dispatched` | event `poojaedit/outbox.dispatched` (not a cron) | `runOnce(prisma, { executionKey: "<domainEventId>:record", … })` | — | Inngest **4** retries; local effect guarded by `SideEffectExecution.executionKey` so a redelivery never double-applies | — |

Schedule owner: the Inngest project for this deployment (one per environment — dev / preview / prod never share a project). Payment reconciliation (§5) and shipment reconciliation are added as further Inngest crons in Phases 7–8 over the `ReconcilePort` interface (`runReconciliation(ports)`).

**`DISPATCHED` ≠ effect completed.** The dispatcher marks an outbox event `DISPATCHED` once the transport (Inngest `send`) acknowledges; the consumer runs afterwards and is made idempotent by `runOnce`. A crash after send but before `markDispatched` leaves the lease to expire (30 s) and the event to be re-claimed and re-sent.

## 4. Replay & manual recovery _(filled Phase 6)_

**Authorised, audited outbox replay.** `replayOutboxAsOwner(outboxEventId, reason?)` (`src/server/events/index.ts`) — `requireOwner()` first, then `replayOutboxEvent` in one transaction: resets the event to `PENDING`, `attempts = 0`, `availableAt = now`, clears the lease; writes an `AdminActivityLog` row (`action: "outbox.replay"`, `entityId = outboxEventId`, `reason`); resolves the `outbox:<id>` `OperationalTask`. The next `dispatch-outbox` tick (≤1 min) re-sends it. Consumers are idempotent, so replaying an event whose effect already ran is safe. No unauthenticated or admin-role (non-owner) replay path exists.

**Triage source.** Open work surfaces as `OperationalTask` rows: `outbox:<id>` (one event exhausted its 8 attempts), `outbox:health` (aggregate — something FAILED or stuck). List with `listOpenOperationalTasks(db, { type: "JOB_FAILURE" })`.

**Manual recovery runbook:**

| Symptom | Diagnosis | Action |
| --- | --- | --- |
| `OperationalTask` `outbox:<id>` open; event `FAILED` | Delivery exhausted 8 attempts. `lastError` on the `OutboxEvent` has the cause. | Fix the downstream cause, then `replayOutboxAsOwner(id, "…")`. It re-queues and resolves the task. Do **not** hand-edit the row. |
| `outbox:health` open, no per-event task | One or more events `DISPATCHING` with an expired lease (worker died mid-send). | Normal self-heal: the next `dispatch-outbox` tick re-claims stale leases (`leaseExpiresAt < now`) and re-sends. If it persists >15 min the transport itself is down — check Inngest status / `INNGEST_*` env. Resolve the task once counts return to zero (next `outbox-health` tick refreshes it). |
| Webhook persistence failure | `ingestWebhook` threw before writing `WebhookEvent` (DB error, not a bad signature). Nothing was acknowledged. | The provider retries on its own schedule (we return 5xx). No local action needed unless the DB outage is ongoing. A verified-but-unpersisted event is never acted on — dedup is keyed on the persisted `(provider, externalEventId)` row. |
| Bad webhook signature | `WebhookVerificationError` → route returns 401, nothing persisted. | Expected for forged/misconfigured calls. If legitimate traffic 401s, the signing secret is wrong — rotate/realign `*_WEBHOOK_SECRET`, no replay needed (provider redelivers). |
| Consumer stuck mid-execution | `SideEffectExecution` row `RUNNING` with an old `updatedAt`, effect not visible. | `runOnce` treats an existing `RUNNING` row as "in progress" and skips — so a truly dead run blocks its key. Confirm the process is gone, then set that `SideEffectExecution.status = 'FAILED'` (single row, by `executionKey`); the next redelivery re-runs it. Redelivery comes from the stale-lease path above or an owner replay. |
| Reservation backlog (sweep not running) | `sweep-reservations` disabled / Inngest project not wired. | Reservations still expire logically (checkout re-checks live stock); the sweep only returns held units to `available` sooner. Re-enable the cron; one-off: call `runReservationSweep(prisma)` from a Node REPL against the target DB. |

## 5. Reconciliation _(filled from Phases 7–9)_

- Payments: periodic reconcile of pending/ambiguous Razorpay payments against provider truth.
- Shipments: poll Shiprocket for missed callbacks; normalize without stale-status regressions.
- Refunds: reconcile unknown provider refund outcomes; enforce aggregate limits (pending + completed).
- COD: collection vs remittance tracked separately; discrepancy workflow.
- External charges/refunds/shipments are **not** undone by a database restore — reconcile explicitly.

## 6. Backup & restore _(filled from Phase 13; exercised before launch)_

- Capture a restorable backup of database **and** required Storage assets.
- Demonstrate restore in an isolated environment (AC-18).
- Verify current Supabase Free-tier backup capability against the live account — do not assume an entitlement.

## 7. Rollback _(filled from Phase 13)_

- Application rollback plan that accounts for forward-compatible schema changes (never roll code back against an incompatible schema without a tested plan).
- Compensating-migration procedure.
- Note: committed external transactions require explicit reconciliation, not rollback.

## 8. Alerts _(filled from Phases 6–13)_

Coverage required at launch: failed payments / reconciliation mismatches, stale outbox, reservation-expiry backlog, failed shipment creation, failed refunds, invoice generation failures, resource/capacity thresholds. Budget alerts configured on all paid-capable providers.

**Phase 6:** stale/failed outbox is covered by the `outbox-health` cron → `OperationalTask` (`outbox:health`); per-event exhaustion → `outbox:<id>`. These land in the admin Needs-Attention queue (Phase 11); an external notifier (email/WhatsApp) on `JOB_FAILURE` task creation is wired in Phase 10.

## 9. Daily operator workflow _(filled from Phase 11)_

Needs Attention triage, pending COD confirmation, payment discrepancy review, COD remittance check, return-inspection workflow.

## 10. Incident notes

_(append-only log of production incidents and their resolution — starts empty)_
