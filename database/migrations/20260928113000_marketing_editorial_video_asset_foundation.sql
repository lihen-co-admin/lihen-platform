-- SOCIAL-03 — governed Instagram Reel editorial video asset foundation.
-- DEV-first durable metadata + governed Storage boundary.
-- Presence never authorizes publication. No scheduler, WhatsApp SEND or PROD activation.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'lihen-editorial-video',
  'lihen-editorial-video',
  true,
  104857600,
  array['video/mp4','video/quicktime']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists marketing_editorial_video_owner_admin_insert on storage.objects;
create policy marketing_editorial_video_owner_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lihen-editorial-video'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  )
);

drop policy if exists marketing_editorial_video_owner_admin_update on storage.objects;
create policy marketing_editorial_video_owner_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'lihen-editorial-video'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  )
)
with check (
  bucket_id = 'lihen-editorial-video'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  )
);

drop policy if exists marketing_editorial_video_owner_admin_delete on storage.objects;
create policy marketing_editorial_video_owner_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lihen-editorial-video'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  )
);

create table public.marketing_editorial_video_assets (
  id uuid primary key,
  product_id uuid not null references public.products(id) on delete restrict,
  public_url text not null,
  mime_type text not null,
  status text not null default 'ACTIVE',
  source_type text not null default 'STORAGE',
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketing_editorial_video_assets_url_not_blank
    check (length(btrim(public_url)) > 0),

  constraint marketing_editorial_video_assets_mime_check
    check (mime_type in ('video/mp4','video/quicktime')),

  constraint marketing_editorial_video_assets_status_check
    check (status in ('ACTIVE','ARCHIVED')),

  constraint marketing_editorial_video_assets_source_check
    check (source_type = 'STORAGE'),

  constraint marketing_editorial_video_assets_bucket_check
    check (storage_bucket = 'lihen-editorial-video'),

  constraint marketing_editorial_video_assets_path_check
    check (
      storage_path =
        'products/' || product_id::text || '/reels/' || id::text ||
        case
          when mime_type = 'video/mp4' then '.mp4'
          when mime_type = 'video/quicktime' then '.mov'
        end
    ),

  constraint marketing_editorial_video_assets_public_url_check
    check (
      public_url like
        '%/storage/v1/object/public/lihen-editorial-video/' || storage_path
    )
);

create index marketing_editorial_video_assets_product_status_idx
  on public.marketing_editorial_video_assets(product_id, status, id);

alter table public.marketing_editorial_video_assets enable row level security;

revoke all on table public.marketing_editorial_video_assets
  from anon, authenticated;

grant select on table public.marketing_editorial_video_assets
  to service_role;

create or replace function public.get_marketing_editorial_video_assets(
  p_product_id uuid
)
returns table (
  id uuid,
  product_id uuid,
  public_url text,
  mime_type text,
  status text,
  source_type text,
  storage_bucket text,
  storage_path text
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501',
            message = 'LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception
      using errcode = '42501',
            message = 'LIHEN_MARKETING_EDITORIAL_VIDEO_READ_FORBIDDEN';
  end if;

  return query
  select
    a.id,
    a.product_id,
    a.public_url,
    a.mime_type,
    a.status,
    a.source_type,
    a.storage_bucket,
    a.storage_path
  from public.marketing_editorial_video_assets a
  where a.product_id = p_product_id
  order by a.created_at asc, a.id asc;
end;
$function$;

revoke all
on function public.get_marketing_editorial_video_assets(uuid)
from public, anon;

grant execute
on function public.get_marketing_editorial_video_assets(uuid)
to authenticated;

comment on table public.marketing_editorial_video_assets is
  'Governed Storage-backed video metadata for editorial Reel publication. Presence never authorizes publication.';
