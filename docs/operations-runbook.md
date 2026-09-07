# Operations Runbook

Deploy/migrate procedures, schedules, replay, reconciliation, backup/restore, and rollback. **Skeleton at Phase 0** — sections are filled by the phase that introduces the capability (noted per section). Nothing operational exists yet.

## 1. Environments

| Environment | Database | Payments | Purpose | Status |
| --- | --- | --- | --- | --- |
| Local dev | Local Postgres / local Supabase / Supabase dev project | Razorpay test | Development, integration tests | Not set up |
| Vercel Preview | Supabase **dev** project | Razorpay test | PR previews — **never** prod data or live credentials | Not set up |
| Production | Supabase **prod** project | Razorpay live | Live store | Not set up |

Environment identity is shown visibly in the admin UI (master §3). Preview must not resolve live credentials by fallback.

## 2. Deploy & migrate _(filled from Phase 1 / Phase 2; release flow finalized Phase 13)_

- Build/deploy: Vercel, Node 22 runtime, frozen-lockfile install.
- Migrations: `prisma migrate deploy` through the release workflow only. **Never** `migrate reset` / `db push` / edit an applied migration against a shared or prod database.
- `prisma migrate dev` only against isolated dev databases; disposable shadow DB when needed.
- Migration policy for production changes: expand → backfill → validate → switch → later contract.

## 3. Scheduled / recurring jobs _(filled from Phase 6)_

Required recurring work (master §8): reservation expiry sweep · outbox dispatch + recovery · payment reconciliation · shipment reconciliation · stale/failed operation alerts. All run as real deployed Inngest schedules — **no** reliance on Vercel request lifetime or in-process timers. Per-job: schedule owner, interval, lease/stale thresholds, retry settings — to be documented here.

## 4. Replay & manual recovery _(filled from Phase 6)_

- Authenticated, audited replay for exhausted outbox events / side-effect executions.
- Manual recovery steps for: stuck dispatcher lease, webhook persistence failure, consumer stuck mid-execution.

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

## 9. Daily operator workflow _(filled from Phase 11)_

Needs Attention triage, pending COD confirmation, payment discrepancy review, COD remittance check, return-inspection workflow.

## 10. Incident notes

_(append-only log of production incidents and their resolution — starts empty)_
