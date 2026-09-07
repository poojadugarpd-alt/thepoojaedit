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
| `reconcile-payments` _(Phase 7)_ | `*/5 * * * *` (every 5 min) | `runReconciliation([makePaymentReconcilePort(prisma, getPaymentProvider())])` | 1 | Per attempt: best-effort; failures counted as `unresolved`, retried next tick | No-op unless Razorpay keys are set. Polls `PaymentAttempt` rows in `CREATED`/`PENDING`/`AUTHORIZED` with a `providerOrderId`, `updatedAt` older than **15 min** (`staleAfterMs`), order still `PENDING_PAYMENT` — fetches `GET /orders/{id}/payments` and settles a captured one / marks AUTHORIZED / marks FAILED. Batch **50**. |
| `reconcile-shipments` _(Phase 8)_ | `*/10 * * * *` (every 10 min) | `runReconciliation([makeShipmentReconcilePort(prisma, getFulfilmentProvider())])` | 1 | Per shipment: best-effort; failures counted as `unresolved` | No-op unless Shadowfax keys are set. Polls `Shipment` rows with a `providerShipmentId` and `statusNormalized` not in {DELIVERED, RTO_RECEIVED, CANCELLED}; calls `fetchTracking` and applies each scan through `applyTrackingEvent` (fingerprint-deduped, stale-guarded). Batch **50**. Catches missed tracking callbacks. |
| `create-shipment-on-confirm` _(Phase 8)_ | event `poojaedit/outbox.dispatched` (not a cron) | `runOnce(prisma, { executionKey: "<domainEventId>:shipment", … }) → ensureShipmentForConfirmedOrder` | 4 | Inngest **4** retries | Fires only for `order.payment_settled` / `order.cod_confirmed` on a CONFIRMED order, when Shadowfax is configured. Idempotent via the unique `merchantReference = SHP-<orderNumber>`. |
| `on-outbox-dispatched` | event `poojaedit/outbox.dispatched` (not a cron) | `runOnce(prisma, { executionKey: "<domainEventId>:record", … })` | — | Inngest **4** retries; local effect guarded by `SideEffectExecution.executionKey` so a redelivery never double-applies | — |

Schedule owner: the Inngest project for this deployment (one per environment — dev / preview / prod never share a project).

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
| `payment-review:<orderId>` task open; order `NEEDS_REVIEW` _(Phase 7)_ | A captured payment did not match the order (amount/currency), was captured after the reservation expired with no stock, or a second payment landed on a settled order (excess capture). The `PaymentAttempt.verification` JSON + `OrderEvent` timeline (`payment.review_required` / `payment.excess_capture` / `order.late_capture_review`) carry the detail. | Reconcile the money against the Razorpay dashboard. Then either: fulfil manually if stock can be sourced and the amount is acceptable (order → CONFIRMED via an audited admin action, Phase 11), or issue a refund with `refundOrder({ orderId, amountPaise, reason, requestedByAdminId })` (aggregate-limit guarded). Resolve the task when settled. No admin override can fabricate a captured payment or bypass the inventory guard. |
| `payment-review:webhook:<paymentId>` task open _(Phase 7)_ | A `payment.captured`/`failed` webhook referenced a provider order with no local `PaymentAttempt` — a payment for an order we never created, or created against the wrong environment's keys. | Look the payment up in the Razorpay dashboard by id. If it is genuinely ours (e.g. keys were rotated mid-flight), reconcile manually; otherwise it is another merchant's / a test artefact — resolve the task. Never auto-create an order from a webhook. |
| `refund-failure:<refundId>` task open _(Phase 7)_ | `createOrderRefund`'s provider call failed or Razorpay reported the refund `failed`; the `Refund` row is `FAILED`. | Check the Razorpay dashboard for the real refund state (it may have partially gone through). If not refunded, retry with a **new** `operationKey`. If it did go through out-of-band, set the `Refund` to `COMPLETED` + `providerRefundId` and run `recomputeOrderPaymentStatus`. |
| `reconcile-payments` cron reporting `unresolved > 0` for the same attempts _(Phase 7)_ | Razorpay API errors, or attempts with a provider order but no payments after 15 min (customer never paid). | Transient API errors clear next tick. A genuinely abandoned attempt: the reservation TTL sweep releases the stock; leave the attempt `CREATED` (the customer can still resume from the order page) or cancel the order via the admin flow. |
| `shipment-failure:<orderId>` task open _(Phase 8)_ | `createShipmentForOrder` hit a Shadowfax error; the `Shipment` row exists with `providerShipmentId = null`. | Fix the cause (address, credentials, Shadowfax status), then re-run `createShipmentForOrderNow(orderId)` — it reuses the same row and, if the provider actually created a shipment on the failed try, adopts it via `fetchTracking(merchantReference)` instead of duplicating. Task auto-resolves on success. |
| `ndr:<shipmentId>` task open _(Phase 8)_ | A delivery attempt failed (Shadowfax NDR). The reason carries the attempt count; `ShipmentEvent` rows list each. | Contact the customer / arrange re-attempt through Shadowfax. The task reopens on each further NDR and resolves automatically when the shipment moves to OUT_FOR_DELIVERY/SHIPPED (a successful re-attempt) — or close it manually on cancellation. |
| `rto:<shipmentId>` / `rto-inspection:<shipmentId>` task open _(Phase 8)_ | Parcel is returning (`RTO_IN_TRANSIT`) or has been received back (`RTO_RECEIVED`). **No stock has been restocked.** | On physical receipt + inspection, call `inspectRtoNow({ shipmentId, adminUserId, outcome, reason })`. `RESTOCK` increments on-hand exactly once (ledger key `rto-restock:<shipmentId>:<variantId>`), writes an `AdminActivityLog` + timeline entry, and resolves the task. `QUARANTINE` / `WRITE_OFF` audit-log only. A re-run restocks nothing. |
| `cod-remittance:<orderId>` task open _(Phase 8)_ | `syncCodRemittance` saw a collected amount ≠ `CodRemittance.expectedPaise`; status is `DISPUTED`; order left `COD_PENDING`. | Reconcile against the Shadowfax COD remittance report. Adjust `CodRemittance` (`collectedPaise` / `status`) with an audited admin action once resolved; set the order to `COD_COLLECTED` only when the full amount is confirmed. |
| `reconcile-shipments` reporting `unresolved > 0` _(Phase 8)_ | Shadowfax tracking API errors, or a shipment with no scans yet. | Transient — clears next tick. If a shipment is stuck days with no scans, check the Shadowfax panel by `merchantReference` / AWB; cancel + recreate if it was never picked up. |

## 5. Reconciliation _(payments filled Phase 7; shipments/refunds Phases 8–9)_

- **Payments (Phase 7):** `reconcile-payments` cron every 5 min (§3) — `makePaymentReconcilePort` polls Razorpay for `PaymentAttempt` rows stuck non-terminal >15 min against orders still `PENDING_PAYMENT`, and settles / marks them from `GET /orders/{id}/payments`. Catches missed or dropped `payment.captured` webhooks. The webhook route itself (`/api/webhooks/razorpay`) is the primary path; reconciliation is the safety net. Ambiguous or mismatched results open a `payment-review:*` `OperationalTask` (see §4) and never auto-fulfil.
- Shipments: poll Shadowfax for missed callbacks; normalize without stale-status regressions.
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

**Phase 7:** payment mismatches / late captures / excess captures → `payment-review:*` tasks (`PAYMENT_REVIEW`); refund failures → `refund-failure:*` (`REFUND_FAILURE`). Same Needs-Attention queue. A `budget alert` on the Razorpay account is a manual dashboard setting to configure when the live account is created (integration-setup.md).

**Phase 8:** failed shipment creation → `shipment-failure:*` (`SHIPMENT_FAILURE`); NDR → `ndr:*` (`NDR`); RTO receipt → `rto-inspection:*` (`RTO_INSPECTION`); COD remittance discrepancy → `cod-remittance:*` (`PAYMENT_REVIEW`). Same queue; recovery steps in §4.

## 9. Daily operator workflow _(filled from Phase 11)_

Needs Attention triage, pending COD confirmation, payment discrepancy review, COD remittance check, return-inspection workflow.

## 10. Incident notes

_(append-only log of production incidents and their resolution — starts empty)_
