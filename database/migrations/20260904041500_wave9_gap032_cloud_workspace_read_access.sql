drop policy if exists lihen_cloud_workspace_authorized_read on storage.objects;

create policy lihen_cloud_workspace_authorized_read
on storage.objects
for select
to authenticated
using (
  bucket_id in (
    'lihen-product-originals',
    'lihen-product-web',
    'catalog-assets',
    'catalog-pdf-artifacts'
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN')
  )
);

comment on policy lihen_cloud_workspace_authorized_read on storage.objects is
  'WAVE 9 / GAP-032: read-only access for active OWNER/ADMIN profiles to existing LIHEN Cloud buckets. Preserves storage.objects as physical authority and unified_asset_artifact_registry as the read projection.';
