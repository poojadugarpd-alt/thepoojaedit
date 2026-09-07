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
| Shiprocket | `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, webhook verification config actually supported by the account/API | Confirm real test mode exists |
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
| Razorpay | 7 | Test mode (keys prefixed for test) | ☐ | Create account, enable Test mode, generate test key id/secret, configure webhook endpoint + secret. UPI + COD flows. |
| Shiprocket | 8 | ⚠️ **Unconfirmed** — must verify from official/account info whether a sandbox exists | ⛔ | If only live ops are available, prepare a controlled authorized test. AC-13 stays blocked until resolved. |
| Inngest (dev) | 6 | Dev server + dev environment keys | ☐ | Install Inngest dev server locally; create cloud dev environment for schedules. |
| Meta WhatsApp Cloud API | 10 | Test number + test recipients | ☐ | App + system user + phone number id; submit templates for approval (lead time). |
| Resend | 10 | Test sending + verified domain | ☐ | Verify sender domain (DNS); create API key; optional delivery webhook. |
| Sentry | 1 | N/A | ☐ | Project + DSN; server auth token only if uploading source maps. |
| Vercel | 12 | Preview environment isolated from prod | ☐ | Project, env var scoping (dev/preview/prod), Node 22 runtime setting. |

## Callback / webhook URLs (to register when each phase lands)

| Purpose | Path (relative to `NEXT_PUBLIC_SITE_URL`) | Phase | Verification mechanism |
| --- | --- | --- | --- |
| Supabase auth callback | `/auth/callback` | 3 | Supabase session exchange. Add to the project's redirect allow-list (see `docs/supabase-setup.md`). |
| Razorpay webhook | `/api/webhooks/razorpay` (final path TBD) | 7 | Raw-body HMAC signature + `RAZORPAY_WEBHOOK_SECRET` |
| Shiprocket callback | `/api/webhooks/shiprocket` (final path TBD) | 8 | Provider's **actual** documented mechanism; if weak/absent, verify critical state against authenticated API |
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
