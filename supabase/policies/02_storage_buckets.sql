-- ─────────────────────────────────────────────────────────────────────────────
-- Storage buckets + policies (master spec §9). Apply in the Supabase SQL editor
-- (or create the buckets in the dashboard, then apply the policies here).
-- Ownership: commerce team. Review against the live project — Storage RLS
-- semantics differ subtly by Supabase version.
-- ─────────────────────────────────────────────────────────────────────────────

-- Buckets ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;

-- Helper: is the current auth user an active admin?
create or replace function public.is_active_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public."AdminUser" a
    where a."authUserId" = auth.uid() and a."isActive"
  );
$$;

-- product-images: public read, active-admin write -----------------------------
drop policy if exists "product_images_read"  on storage.objects;
drop policy if exists "product_images_write" on storage.objects;
drop policy if exists "product_images_update" on storage.objects;
drop policy if exists "product_images_delete" on storage.objects;

create policy "product_images_read" on storage.objects
  for select using ( bucket_id = 'product-images' );

create policy "product_images_write" on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'product-images' and public.is_active_admin() );

create policy "product_images_update" on storage.objects
  for update to authenticated
  using ( bucket_id = 'product-images' and public.is_active_admin() );

create policy "product_images_delete" on storage.objects
  for delete to authenticated
  using ( bucket_id = 'product-images' and public.is_active_admin() );

-- documents: no public/anon policy at all → private. Server issues short-lived
-- signed URLs for authorized downloads. Admins may manage objects directly.
drop policy if exists "documents_admin_all" on storage.objects;

create policy "documents_admin_all" on storage.objects
  for all to authenticated
  using ( bucket_id = 'documents' and public.is_active_admin() )
  with check ( bucket_id = 'documents' and public.is_active_admin() );
