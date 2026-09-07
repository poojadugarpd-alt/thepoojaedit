# `src/server` — domain services

Every commerce rule lives in exactly one service here. Route handlers, Server
Actions, admin screens and Inngest jobs are thin adapters that **call** these
modules; they never re-implement the rule.

## Conventions

- **Server-only.** Each entry module starts with `import "server-only";` once real
  code lands. Nothing here may be imported into a client component.
- **Prisma owns the data.** Services use the shared Prisma client (`src/lib/db`,
  added in Phase 2). Supabase SDK is for Auth + Storage only.
- **Provider payloads stay in adapters.** e.g. `payments/` exposes a
  provider-neutral interface; Razorpay specifics live in `payments/razorpay/`.
- **Authorization is explicit.** Sensitive operations call `requireAdmin()` or an
  ownership guard themselves — never rely on route protection.
- **Catalog scope is mandatory.** Every catalog query carries `CatalogType`.

## Modules

See [`docs/module-map.md`](../../docs/module-map.md) for the responsibility of
each folder and the phase it is first built in.
