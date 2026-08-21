create table if not exists public.product_images (
  id uuid primary key,
  product_id uuid not null references public.products(id) on delete restrict,
  public_url text not null,
  storage_bucket text null,
  storage_path text null,
  alt_text text null,
  is_main boolean not null default false,
  sort_order integer not null default 0,
  source_type text not null default 'MANUAL',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_images_public_url_not_blank check (btrim(public_url) <> ''),
  constraint product_images_sort_order_nonnegative check (sort_order >= 0),
  constraint product_images_source_type_check check (source_type in ('MANUAL','LEGACY_MAIN_IMAGE_URL')),
  constraint product_images_status_check check (status in ('ACTIVE','ARCHIVED')),
  constraint product_images_storage_pair_check check ((storage_bucket is null and storage_path is null) or (storage_bucket is not null and storage_path is not null))
);

create index if not exists product_images_product_sort_idx
  on public.product_images(product_id, sort_order, id);

create unique index if not exists product_images_one_active_main_per_product_idx
  on public.product_images(product_id)
  where is_main = true and status = 'ACTIVE';

alter table public.product_images enable row level security;

revoke all on table public.product_images from anon, authenticated;
grant select on table public.product_images to service_role;

-- Explicit fail-closed policy keeps the exposed table inaccessible directly.
drop policy if exists product_images_direct_read_denied on public.product_images;
create policy product_images_direct_read_denied
on public.product_images
for select
to authenticated
using (false);

create or replace function lihen_private.get_product_images_authorized(p_product_id uuid)
returns table (
  id uuid,
  product_id uuid,
  public_url text,
  storage_bucket text,
  storage_path text,
  alt_text text,
  is_main boolean,
  sort_order integer,
  source_type text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')
  ) then
    raise exception 'LIHEN_PRODUCT_IMAGES_READ_FORBIDDEN';
  end if;

  if not exists (select 1 from public.products p where p.id = p_product_id) then
    raise exception 'LIHEN_PRODUCT_NOT_FOUND';
  end if;

  return query
  select i.id, i.product_id, i.public_url, i.storage_bucket, i.storage_path,
         i.alt_text, i.is_main, i.sort_order, i.source_type, i.status,
         i.created_at, i.updated_at
  from public.product_images i
  where i.product_id = p_product_id
    and i.status = 'ACTIVE'
  order by i.is_main desc, i.sort_order asc, i.id asc;
end;
$$;

revoke execute on function lihen_private.get_product_images_authorized(uuid) from public, anon, authenticated;

create or replace function public.get_product_images(p_product_id uuid)
returns table (
  id uuid,
  product_id uuid,
  public_url text,
  storage_bucket text,
  storage_path text,
  alt_text text,
  is_main boolean,
  sort_order integer,
  source_type text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from lihen_private.get_product_images_authorized(p_product_id);
$$;

revoke execute on function public.get_product_images(uuid) from public, anon;
grant execute on function public.get_product_images(uuid) to authenticated;

comment on table public.product_images is 'Canonical product image metadata. Storage writes remain disabled in FASE 1.14.';
comment on column public.product_images.public_url is 'Transitional render URL; future Storage-backed images may also populate storage_bucket/storage_path.';
