# Integration Setup Checklist

Account setup, environment variable **names** (never values), callback URLs, and which test/live modes are enabled. **No secrets in this file, ever.** `.env.example` (Phase 1) carries the full variable list with empty values and descriptions.

Legend: ☐ not started · ◐ partial · ☑ done · ⛔ blocked

## Environment variable groups (from master §3)

| Group | Variable names | Notes |
| --- | --- | --- |
| Site | `NEXT_PUBLIC_SITE_URL`, environment identity flag | Environment shown visibly in admin |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server-only, if needed) | Separate dev + prod projects |
| Database | `DATABASE_URL` (Supavisor txn pooler :6543 `?pgbouncer=true`), `DIRECT_URL` (session mode :5432), `SHADOW_DATABASE_URL` (optional, disposable) | — |
| Razorpay | `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Test mode first |
| Shadowfax _(master v1.1; single carrier)_ | `SHADOWFAX_API_TOKEN`, `SHADOWFAX_CLIENT_ID`, optional `SHADOWFAX_API_BASE`, optional `SHADOWFAX_WEBHOOK_TOKEN` | Weak/absent callback auth is expected — status is re-verified against the tracking API |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET` | Approved templates only |
| Email | `RESEND_API_KEY`, verified sender identity, webhook secret (if callbacks enabled) | — |
| Jobs | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | — |
| Monitoring | Sentry DSN, server-only Sentry auth token (if source maps uploaded), `LOG_LEVEL` | — |
| Business | Legal name, GSTIN, supplier state/address, invoice series, contact details, policy text — editable nonsecret settings may live in Postgres (`StoreSettings`) | Owner-confirmed before live |

## Provider accounts

| Provider | Needed by phase | Test/sandbox mode | Status | Setup notes |
| --- | --- | --- | --- | --- |
| Local PostgreSQL (dev/test) | 2 | N/A | ☑ | `embedded-postgres` (`npm run db:dev`) — real PG 17, no Docker/account (D-17). Covers Phase 2 fully. |
| Supabase (dev project) | 3 | N/A (hosted; local CLI needs Docker) | ☐ | First needed Phase 3 (Auth + Storage) and for the deferred Supavisor+Prisma concurrency proof (D-open-4). Record project ref, region. Verify Free-tier allowances, pause behavior, backup entitlement **against the live account** — do not assume. |
| Supabase (prod project) | 13 | N/A | ☐ | Separate project. Auth redirect URLs, active owner, Data API restrictions, Storage policies verified at launch. |
| Razorpay | 7 | Test mode (keys prefixed for test) | ◐ | **Code slice done (Phase 7)** — adapter, checkout UI, webhook route, reconcile cron all built + tested against `FakeRazorpay`. **To go live in test mode:** create account → enable Test mode → generate test key id/secret → set `NEXT_PUBLIC_RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` + `RAZORPAY_WEBHOOK_SECRET` → register the webhook URL below with events `payment.authorized`, `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`. Then run a real test payment (UPI/card) + verify a real signed webhook. Budget alert on the account. |
| Shadowfax | 8 | ⚠️ **Unconfirmed** — verify from the merchant account whether a sandbox / provider-supported test exists | ◐ | **Code slice done (Phase 8)** — adapter, service, webhook route, reconcile + auto-create Inngest fns, label route, all tested against `FakeShadowfax`. **To go live:** obtain merchant API credentials → set `SHADOWFAX_API_TOKEN` + `SHADOWFAX_CLIENT_ID` (+ `SHADOWFAX_WEBHOOK_TOKEN` if the account echoes one) → **confirm the real endpoint paths / payload fields** in `src/server/shadowfax.ts` against the account's API docs → register the callback URL below → run a real shipment create + tracking + label + COD remittance. If only live ops are available, prepare a controlled authorised test. AC-13 stays blocked until resolved. _(Provider changed from Shiprocket at the owner's direction — master v1.1 / D-59.)_ |
| Inngest (dev) | 6 | Dev server + dev environment keys | ☐ | Install Inngest dev server locally; create cloud dev environment for schedules. |
| Meta WhatsApp Cloud API | 10 | Test number + test recipients | ☐ | App + system user + phone number id; submit templates for approval (lead time). |
| Resend | 10 | Test sending + verified domain | ☐ | Verify sender domain (DNS); create API key; optional delivery webhook. |
| Sentry | 1 | N/A | ☐ | Project + DSN; server auth token only if uploading source maps. |
| Vercel | 12 | Preview environment isolated from prod | ☐ | Project, env var scoping (dev/preview/prod), Node 22 runtime setting. |

## Callback / webhook URLs (to register when each phase lands)

| Purpose | Path (relative to `NEXT_PUBLIC_SITE_URL`) | Phase | Verification mechanism |
| --- | --- | --- | --- |
| Supabase auth callback | `/auth/callback` | 3 | Supabase session exchange. Add to the project's redirect allow-list (see `docs/supabase-setup.md`). |
| Razorpay webhook | `/api/webhooks/razorpay` | 7 | Raw-body HMAC-SHA256 of the request bytes vs `X-Razorpay-Signature` + `RAZORPAY_WEBHOOK_SECRET`. Event id from `X-Razorpay-Event-Id`. Built + tested (`payments.itest.ts`); path is final. |
| Shadowfax tracking callback | `/api/webhooks/shadowfax` | 8 | Optional static `SHADOWFAX_WEBHOOK_TOKEN` (checked constant-time if set) as a coarse gate; the body is then **ignored** and the shipment status is re-read from the authenticated tracking API. Redelivery deduped by `sha256(rawBody)` fingerprint. Path is final. |
| Inngest endpoint | `/api/inngest` | 6 | `INNGEST_SIGNING_KEY` |
| WhatsApp status callback | `/api/webhooks/whatsapp` (final path TBD) | 10 | `META_APP_SECRET` signature + `WHATSAPP_VERIFY_TOKEN` handshake |
| Resend delivery webhook | `/api/webhooks/resend` (final path TBD) | 10 | Resend webhook secret (if enabled) |

## Business configuration gate (master §6, playbook §2)

Development uses **clearly labelled test fixtures**. Live checkout / live invoices require owner-confirmed, real values for all of:

- ☐ Legal business name + registered address
- ☐ GSTIN + supplier state
- ☐ HSN codes + GST rates per product tax class (STANDARD treatment)
- ☐ Inclusive vs exclusive pricing policy; shipping & COD-fee tax treatment
- ☐ Invoice series / financial-year numbering format; invoice issuance timing
- ☐ Shipping rules, COD rules (postcode/serviceability/value/catalog/fees), returns & exchange policy windows
- ☐ Contact details (support email/phone), policy page text (shipping, returns, privacy, terms)

The agent does not invent any of these.
