-- Public Hub / Catalog publication completion.
-- One canonical catalog version may publish independently rendered artifacts
-- for ALL, BEAUTY_CARE and STYLE without duplicating Catalog Version authority.
-- LOCAL FOUNDATION ONLY until explicitly reviewed/applied.

create table if not exists public.catalog_pdf_artifacts (
  id uuid primary key default gen_random_uuid(),
  catalog_version_id uuid not null
    references public.catalog_versions(id) on delete restrict,
  scope text not null,
  artifact_url text not null,
  artifact_sha256 text not null,
  artifact_page_count integer not null,
  artifact_size_bytes bigint not null,
  renderer_version text not null,
  generated_at timestamptz not null default now(),
  registered_by uuid null
    references public.profiles(id) on delete set null,
  constraint catalog_pdf_artifacts_scope_allowed
    check (scope in ('ALL','BEAUTY_CARE','STYLE')),
  constraint catalog_pdf_artifacts_url_not_blank
    check (btrim(artifact_url) <> ''),
  constraint catalog_pdf_artifacts_url_https
    check (artifact_url ~* '^https://[^[:space:]]+$'),
  constraint catalog_pdf_artifacts_sha256_format
    check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  constraint catalog_pdf_artifacts_page_count_positive
    check (artifact_page_count > 0),
  constraint catalog_pdf_artifacts_size_positive
    check (artifact_size_bytes > 0),
  constraint catalog_pdf_artifacts_renderer_not_blank
    check (btrim(renderer_version) <> ''),
  constraint catalog_pdf_artifacts_version_scope_unique
    unique (catalog_version_id, scope)
);

alter table public.catalog_pdf_artifacts enable row level security;

revoke all on public.catalog_pdf_artifacts
from public, anon, authenticated;

grant select on public.catalog_pdf_artifacts to authenticated;

create policy catalog_pdf_artifacts_admin_read
on public.catalog_pdf_artifacts
for select to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')
  )
);

create or replace function public.register_pdf_catalog_line_artifact_controlled(
  p_catalog_version_id uuid,
  p_scope text,
  p_artifact_url text,
  p_artifact_sha256 text,
  p_page_count integer,
  p_size_bytes bigint,
  p_renderer_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_scope text := upper(btrim(coalesce(p_scope,'')));
  v_entry_count bigint;
  v_id uuid;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id=v_actor
      and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501',
      message='LIHEN_CATALOG_WRITE_FORBIDDEN';
  end if;

  if v_scope not in ('ALL','BEAUTY_CARE','STYLE') then
    raise exception using errcode='22023',
      message='LIHEN_CATALOG_PDF_SCOPE_INVALID';
  end if;

  select cv.status
  into v_status
  from public.catalog_versions cv
  where cv.id=p_catalog_version_id
  for update;

  if v_status is null then
    raise exception using errcode='P0002',
      message='LIHEN_CATALOG_VERSION_NOT_FOUND';
  end if;

  if v_status <> 'ACTIVE' then
    raise exception using errcode='55000',
      message='LIHEN_CATALOG_ARTIFACT_REQUIRES_ACTIVE_VERSION';
  end if;

  select count(*)
  into v_entry_count
  from public.catalog_entries e
  where e.catalog_version_id=p_catalog_version_id
    and e.visible
    and (
      v_scope='ALL'
      or e.business_line_snapshot=v_scope
    );

  if v_entry_count=0 then
    raise exception using errcode='23514',
      message='LIHEN_CATALOG_PDF_SCOPE_HAS_NO_VISIBLE_ENTRIES';
  end if;

  if nullif(btrim(p_artifact_url),'') is null then
    raise exception using errcode='22023',
      message='LIHEN_CATALOG_ARTIFACT_URL_REQUIRED';
  end if;

  if btrim(p_artifact_url) !~* '^https://[^[:space:]]+$' then
    raise exception using errcode='22023',
      message='LIHEN_CATALOG_ARTIFACT_URL_INVALID';
  end if;

  if lower(btrim(p_artifact_sha256)) !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023',
      message='LIHEN_CATALOG_ARTIFACT_SHA256_INVALID';
  end if;

  if p_page_count is null or p_page_count <= 0 then
    raise exception using errcode='22023',
      message='LIHEN_CATALOG_ARTIFACT_PAGE_COUNT_INVALID';
  end if;

  if p_size_bytes is null or p_size_bytes <= 0 then
    raise exception using errcode='22023',
      message='LIHEN_CATALOG_ARTIFACT_SIZE_INVALID';
  end if;

  if nullif(btrim(p_renderer_version),'') is null then
    raise exception using errcode='22023',
      message='LIHEN_CATALOG_RENDERER_VERSION_REQUIRED';
  end if;

  if exists (
    select 1
    from public.catalog_pdf_artifacts a
    where a.catalog_version_id=p_catalog_version_id
      and a.scope=v_scope
  ) then
    raise exception using errcode='55000',
      message='LIHEN_CATALOG_LINE_ARTIFACT_ALREADY_REGISTERED';
  end if;

  insert into public.catalog_pdf_artifacts (
    catalog_version_id,
    scope,
    artifact_url,
    artifact_sha256,
    artifact_page_count,
    artifact_size_bytes,
    renderer_version,
    registered_by
  )
  values (
    p_catalog_version_id,
    v_scope,
    btrim(p_artifact_url),
    lower(btrim(p_artifact_sha256)),
    p_page_count,
    p_size_bytes,
    btrim(p_renderer_version),
    v_actor
  )
  returning id into v_id;

  insert into public.domain_events (
    id,event_type,aggregate_type,aggregate_id,
    occurred_at,actor_id,payload,metadata
  )
  values (
    gen_random_uuid(),
    'CATALOG_PDF_LINE_ARTIFACT_REGISTERED',
    'CATALOG_VERSION',
    p_catalog_version_id,
    now(),
    v_actor,
    jsonb_build_object(
      'artifact_id',v_id,
      'scope',v_scope,
      'sha256',lower(btrim(p_artifact_sha256)),
      'page_count',p_page_count,
      'size_bytes',p_size_bytes,
      'renderer_version',btrim(p_renderer_version)
    ),
    jsonb_build_object(
      'surface','PUBLIC_HUB',
      'publication_contract','CATALOG_LINE_ARTIFACT_V1'
    )
  );

  return v_id;
end;
$function$;

revoke all on function
  public.register_pdf_catalog_line_artifact_controlled(
    uuid,text,text,text,integer,bigint,text
  )
from public, anon;

grant execute on function
  public.register_pdf_catalog_line_artifact_controlled(
    uuid,text,text,text,integer,bigint,text
  )
to authenticated;

create or replace function public.get_public_hub_resources_controlled()
returns table (
  storefront_url text,
  whatsapp_url text,
  instagram_url text,
  tiktok_url text,
  facebook_url text,
  whatsapp_community_url text,
  beauty_care_pdf_url text,
  style_pdf_url text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from lihen_private.phase_exit_gate_results g
    where g.phase_code='4'
      and g.status='PASS'
  ) then
    raise exception using errcode='55000',
      message='LIHEN_PHASE4_NOT_CLOSED';
  end if;

  return query
  select
    nullif(btrim(c.channels->>'storefront_url'),''),
    nullif(btrim(c.channels->>'whatsapp_url'),''),
    nullif(btrim(c.channels->>'instagram_url'),''),
    nullif(btrim(c.channels->>'tiktok_url'),''),
    nullif(btrim(c.channels->>'facebook_url'),''),
    nullif(btrim(c.channels->>'whatsapp_community_url'),''),
    (
      select a.artifact_url
      from public.catalog_versions cv
      join public.catalog_pdf_artifacts a
        on a.catalog_version_id=cv.id
       and a.scope='BEAUTY_CARE'
      where cv.source_type='PDF'
        and cv.status='ACTIVE'
      order by cv.activated_at desc nulls last, a.generated_at desc
      limit 1
    ),
    (
      select a.artifact_url
      from public.catalog_versions cv
      join public.catalog_pdf_artifacts a
        on a.catalog_version_id=cv.id
       and a.scope='STYLE'
      where cv.source_type='PDF'
        and cv.status='ACTIVE'
      order by cv.activated_at desc nulls last, a.generated_at desc
      limit 1
    )
  from public.catalog_institutional_content c
  where c.id='default';
end;
$function$;

revoke all on function public.get_public_hub_resources_controlled()
from public;

grant execute on function public.get_public_hub_resources_controlled()
to anon, authenticated;

comment on table public.catalog_pdf_artifacts is
  'Published immutable PDF artifacts derived from one canonical Catalog Version and scoped to ALL, BEAUTY_CARE or STYLE. Does not replace Catalog Version authority or storage.objects physical authority.';

comment on function public.get_public_hub_resources_controlled() is
  'Minimal public projection for LIHEN Public Hub: governed institutional channel destinations plus currently published Beauty Care and Style PDF artifact URLs.';
