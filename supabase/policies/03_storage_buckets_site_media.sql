-- ─────────────────────────────────────────────────────────────────────────────
-- `site-media` bucket (owner follow-up, 2026-09-13 — home-page custom hero/
-- editorial photos and short videos, independent of any product). Same
-- public-read / active-admin-write shape as `product-images`
-- (02_storage_buckets.sql) — apply in the Supabase SQL editor after that file.
-- NOT YET APPLIED to the live project — reviewed with the owner before this
-- runs, since it creates real infrastructure on the live Supabase project.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do update set public = true;

-- Reuses public.is_active_admin(), defined in 02_storage_buckets.sql.

drop policy if exists "site_media_read"   on storage.objects;
drop policy if exists "site_media_write"  on storage.objects;
drop policy if exists "site_media_update" on storage.objects;
drop policy if exists "site_media_delete" on storage.objects;

create policy "site_media_read" on storage.objects
  for select using ( bucket_id = 'site-media' );

create policy "site_media_write" on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'site-media' and public.is_active_admin() );

create policy "site_media_update" on storage.objects
  for update to authenticated
  using ( bucket_id = 'site-media' and public.is_active_admin() );

create policy "site_media_delete" on storage.objects
  for delete to authenticated
  using ( bucket_id = 'site-media' and public.is_active_admin() );
