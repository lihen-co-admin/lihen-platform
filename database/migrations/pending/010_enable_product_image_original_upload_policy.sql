-- PENDING CUTOVER ONLY — DO NOT APPLY IN FASE 1.17.
-- This policy would allow OWNER/ADMIN + ACTIVE to upload immutable ORIGINAL objects only.
-- Preconditions:
--   1) buckets created via supported Supabase Storage API/CLI/Dashboard
--   2) real OWNER/ADMIN session probe
--   3) image metadata writes explicitly enabled
--   4) upload orchestration transaction/outbox design approved
--   5) explicit human approval
-- WEB derivative writes intentionally remain server/worker-only.

create policy "lihen_product_originals_owner_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lihen-product-originals'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  )
  and (storage.foldername(name))[1] = 'products'
);
