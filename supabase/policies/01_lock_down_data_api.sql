-- ─────────────────────────────────────────────────────────────────────────────
-- Lock the Supabase Data API (PostgREST) away from every commerce table.
-- Ownership: commerce team. Apply in the Supabase SQL editor AFTER
-- `prisma migrate deploy`, and re-run after any migration that creates tables
-- (or rely on the ALTER DEFAULT PRIVILEGES lines below).
--
-- Why the PUBLIC lines matter: PostgreSQL grants privileges to the built-in
-- PUBLIC role by default, so `REVOKE ... FROM anon` alone is a no-op — the
-- access is still there via PUBLIC. (Learned the hard way on a sibling project.)
--
-- Prisma is unaffected: it connects as the privileged Postgres/service role,
-- which owns these objects and is not subject to these grants.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all tables    in schema public from public;
revoke all on all sequences in schema public from anon, authenticated, public;
revoke all on all routines   in schema public from anon, authenticated, public;

alter default privileges in schema public revoke all on tables    from anon, authenticated, public;
alter default privileges in schema public revoke all on sequences from anon, authenticated, public;
alter default privileges in schema public revoke all on routines   from anon, authenticated, public;

-- Belt-and-braces: RLS on with no policies = deny all through the Data API,
-- even if a future grant slips through.
--
-- IMPORTANT: use ENABLE, not FORCE. ENABLE leaves the table owner and any
-- BYPASSRLS role (Prisma's connection role on Supabase) unaffected; FORCE would
-- apply RLS to the owner too and break every Prisma query. Verify the Prisma
-- role's rls-bypass against the live project before trusting this.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '_prisma_migrations'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Verify (expect 0 rows / permission denied when run with the anon key):
--   select * from "Product" limit 1;
