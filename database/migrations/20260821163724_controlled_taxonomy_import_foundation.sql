-- FASE 1.20.2 — Controlled Taxonomy Import Foundation
-- Prepares a controlled/idempotent import of APPROVE_NEW_ENTITY taxonomy decisions.
-- IMPORTANT: the import RPC is installed but EXECUTE remains revoked for anon/authenticated.
-- No product rows are touched by this migration.

create table if not exists lihen_private.taxonomy_import_operations (
  operation_key text primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  run_id uuid not null references lihen_private.taxonomy_reconciliation_runs(id) on delete restrict,
  request_fingerprint text not null,
  status text not null,
  result_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint taxonomy_import_operation_key_not_blank check (length(btrim(operation_key)) > 0),
  constraint taxonomy_import_operation_fingerprint_not_blank check (length(btrim(request_fingerprint)) > 0),
  constraint taxonomy_import_operation_status_check check (status in ('COMPLETED','FAILED'))
);

revoke all on table lihen_private.taxonomy_import_operations
  from public, anon, authenticated;

create or replace function lihen_private.normalize_taxonomy_name(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select regexp_replace(
    lower(
      translate(
        btrim(p_value),
        'ÁÉÍÓÚÜÑáéíóúüñ',
        'AEIOUUNaeiouun'
      )
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  )::text
$$;

revoke all on function lihen_private.normalize_taxonomy_name(text)
  from public, anon, authenticated;
grant execute on function lihen_private.normalize_taxonomy_name(text) to postgres;

create or replace function lihen_private.taxonomy_slug(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select regexp_replace(
    lihen_private.normalize_taxonomy_name(p_value),
    '[[:space:]]+',
    '-',
    'g'
  )::text
$$;

revoke all on function lihen_private.taxonomy_slug(text)
  from public, anon, authenticated;
grant execute on function lihen_private.taxonomy_slug(text) to postgres;

create or replace function lihen_private.preview_taxonomy_import(p_run_id uuid)
returns table (
  source_record_key text,
  entity_type text,
  canonical_name text,
  normalized_name text,
  source_page integer,
  import_status text,
  existing_entity_id uuid,
  reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  with approved as (
    select
      r.source_record_key,
      r.entity_type,
      d.canonical_name,
      s.source_page,
      lihen_private.normalize_taxonomy_name(d.canonical_name) as normalized_name
    from lihen_private.taxonomy_reconciliation_results r
    join lihen_private.taxonomy_reconciliation_decisions d
      on d.run_id = r.run_id
     and d.source_record_key = r.source_record_key
    join lihen_private.taxonomy_reconciliation_runs rr
      on rr.id = r.run_id
    join lihen_private.taxonomy_source_records s
      on s.source_key = rr.source_key
     and s.source_record_key = r.source_record_key
    where r.run_id = p_run_id
      and rr.status = 'COMPLETED'
      and d.decision = 'APPROVE_NEW_ENTITY'
      and d.canonical_name is not null
  ),
  duplicate_approval as (
    select entity_type, normalized_name, count(*) as n
    from approved
    group by entity_type, normalized_name
  ),
  classified as (
    select
      a.*,
      case
        when da.n > 1 then 'CONFLICT_NORMALIZED_NAME'
        when a.entity_type = 'BRAND' and exists (
          select 1 from public.brands b
          where lihen_private.normalize_taxonomy_name(b.name) = a.normalized_name
             or b.normalized_name = a.normalized_name
        ) then 'ALREADY_EXISTS'
        when a.entity_type = 'CATEGORY' and exists (
          select 1 from public.categories c
          where c.parent_id is null
            and (lihen_private.normalize_taxonomy_name(c.name) = a.normalized_name
              or c.normalized_name = a.normalized_name)
        ) then 'ALREADY_EXISTS'
        else 'READY_CREATE'
      end as import_status
    from approved a
    join duplicate_approval da
      on da.entity_type = a.entity_type
     and da.normalized_name = a.normalized_name
  )
  select
    c.source_record_key,
    c.entity_type,
    c.canonical_name,
    c.normalized_name,
    c.source_page,
    c.import_status,
    case
      when c.entity_type = 'BRAND' then (
        select b.id from public.brands b
        where lihen_private.normalize_taxonomy_name(b.name) = c.normalized_name
           or b.normalized_name = c.normalized_name
        order by b.created_at, b.id
        limit 1
      )
      when c.entity_type = 'CATEGORY' then (
        select cat.id from public.categories cat
        where cat.parent_id is null
          and (lihen_private.normalize_taxonomy_name(cat.name) = c.normalized_name
            or cat.normalized_name = c.normalized_name)
        order by cat.created_at, cat.id
        limit 1
      )
      else null
    end as existing_entity_id,
    case
      when c.import_status = 'READY_CREATE' then 'APPROVED_NEW_ENTITY_AND_NO_EXISTING_NORMALIZED_NAME'
      when c.import_status = 'ALREADY_EXISTS' then 'CANONICAL_NORMALIZED_NAME_ALREADY_PRESENT'
      else 'DUPLICATE_APPROVED_NORMALIZED_NAME_REQUIRES_REVIEW'
    end as reason
  from classified c
  order by c.entity_type, c.source_page nulls last, c.canonical_name;
$$;

revoke all on function lihen_private.preview_taxonomy_import(uuid)
  from public, anon, authenticated;
grant execute on function lihen_private.preview_taxonomy_import(uuid) to postgres;

create or replace function public.import_approved_taxonomy_controlled(
  p_operation_key text,
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_fingerprint text;
  v_existing lihen_private.taxonomy_import_operations%rowtype;
  v_preview_count integer;
  v_ready_count integer;
  v_existing_count integer;
  v_conflict_count integer;
  v_brand_created integer := 0;
  v_category_created integer := 0;
  v_result jsonb;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN')
  ) then
    raise exception using errcode = '42501', message = 'LIHEN_TAXONOMY_IMPORT_FORBIDDEN';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_OPERATION_KEY_REQUIRED';
  end if;

  if p_run_id is null then
    raise exception using errcode = '22023', message = 'LIHEN_TAXONOMY_RUN_ID_REQUIRED';
  end if;

  if not exists (
    select 1 from lihen_private.taxonomy_reconciliation_runs r
    where r.id = p_run_id and r.status = 'COMPLETED'
  ) then
    raise exception using errcode = '22023', message = 'LIHEN_TAXONOMY_RUN_NOT_COMPLETED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('LIHEN_TAXONOMY_IMPORT', 0));

  select count(*),
         count(*) filter (where p.import_status = 'READY_CREATE'),
         count(*) filter (where p.import_status = 'ALREADY_EXISTS'),
         count(*) filter (where p.import_status like 'CONFLICT%')
    into v_preview_count, v_ready_count, v_existing_count, v_conflict_count
  from lihen_private.preview_taxonomy_import(p_run_id) p;

  if v_preview_count = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_TAXONOMY_IMPORT_NO_APPROVED_ENTITIES';
  end if;

  if v_conflict_count > 0 then
    raise exception using errcode = '23505', message = 'LIHEN_TAXONOMY_IMPORT_CONFLICT_REVIEW_REQUIRED';
  end if;

  v_fingerprint := md5(concat_ws('|',
    p_run_id::text,
    v_preview_count::text,
    v_ready_count::text,
    v_existing_count::text
  ));

  select o.* into v_existing
  from lihen_private.taxonomy_import_operations o
  where o.operation_key = btrim(p_operation_key);

  if found then
    if v_existing.actor_id <> v_actor_id
      or v_existing.run_id <> p_run_id
      or v_existing.request_fingerprint is distinct from v_fingerprint
      or v_existing.status <> 'COMPLETED' then
      raise exception using errcode = '23505', message = 'LIHEN_TAXONOMY_IMPORT_OPERATION_CONFLICT';
    end if;
    return v_existing.result_snapshot;
  end if;

  insert into public.brands (name, normalized_name, status)
  select p.canonical_name, p.normalized_name, 'ACTIVE'
  from lihen_private.preview_taxonomy_import(p_run_id) p
  where p.entity_type = 'BRAND'
    and p.import_status = 'READY_CREATE';
  get diagnostics v_brand_created = row_count;

  insert into public.categories (
    name, normalized_name, slug, business_line, parent_id, status, sort_order
  )
  select
    p.canonical_name,
    p.normalized_name,
    lihen_private.taxonomy_slug(p.canonical_name),
    null,
    null,
    'ACTIVE',
    row_number() over (order by p.source_page nulls last, p.canonical_name)::integer - 1
  from lihen_private.preview_taxonomy_import(p_run_id) p
  where p.entity_type = 'CATEGORY'
    and p.import_status = 'READY_CREATE';
  get diagnostics v_category_created = row_count;

  v_result := jsonb_build_object(
    'run_id', p_run_id,
    'preview_count', v_preview_count,
    'already_existing', v_existing_count,
    'brands_created', v_brand_created,
    'categories_created', v_category_created,
    'completed_at', now()
  );

  insert into lihen_private.taxonomy_import_operations (
    operation_key, actor_id, run_id, request_fingerprint, status, result_snapshot, completed_at
  ) values (
    btrim(p_operation_key), v_actor_id, p_run_id, v_fingerprint, 'COMPLETED', v_result, now()
  );

  return v_result;
end;
$$;

revoke all on function public.import_approved_taxonomy_controlled(text, uuid)
  from public, anon, authenticated;
grant execute on function public.import_approved_taxonomy_controlled(text, uuid) to postgres;

comment on function public.import_approved_taxonomy_controlled(text, uuid) is
  'FASE 1.20.2 foundation only. Controlled/idempotent taxonomy import. Authenticated EXECUTE intentionally revoked until cutover.';
