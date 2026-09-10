begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'lihen-intelligence-review',
  'lihen-intelligence-review',
  false,
  20971520,
  array['image/png']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists lihen_private.intelligence_image_transformation_candidates (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  correlation_id text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  source_product_image_id uuid not null references public.product_images(id) on delete restrict,
  operation_code text not null
    check (operation_code = 'REMOVE_BACKGROUND'),
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null
    check (mime_type = 'image/png'),
  sha256 text not null,
  provider_name text not null,
  intended_use text not null,
  constraints jsonb not null default '[]'::jsonb,
  status text not null default 'PENDING_REVIEW'
    check (status = 'PENDING_REVIEW'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint intelligence_image_transformation_candidates_request_source_operation_key
    unique (request_id, source_product_image_id, operation_code)
);

revoke all
on table lihen_private.intelligence_image_transformation_candidates
from public, anon, authenticated;

grant usage on schema lihen_private to service_role;

grant select, insert
on table lihen_private.intelligence_image_transformation_candidates
to service_role;

commit;
