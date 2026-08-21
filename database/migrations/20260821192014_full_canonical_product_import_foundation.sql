create table if not exists lihen_private.full_canonical_product_import_runs (
  id uuid primary key default gen_random_uuid(),
  candidate_run_id uuid not null references lihen_private.product_import_candidate_runs(id) on delete restrict,
  business_line text not null references public.business_lines(code) on delete restrict,
  scope text not null check (scope='FULL_CANONICAL_APPROVED'),
  strategy_version text not null check (length(btrim(strategy_version))>0),
  status text not null default 'DRAFT' check (status in ('DRAFT','COMPLETED','SUPERSEDED')),
  canonical_approved_count integer not null default 0 check (canonical_approved_count>=0),
  human_approved_count integer not null default 0 check (human_approved_count>=0),
  policy_approved_count integer not null default 0 check (policy_approved_count>=0),
  rejected_excluded_count integer not null default 0 check (rejected_excluded_count>=0),
  deferred_excluded_count integer not null default 0 check (deferred_excluded_count>=0),
  sku_strategy text not null,
  catalog_code_strategy text not null,
  slug_strategy text not null,
  product_id_strategy text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  unique(candidate_run_id,scope,strategy_version)
);

create table if not exists lihen_private.full_canonical_product_import_candidates (
  import_run_id uuid not null references lihen_private.full_canonical_product_import_runs(id) on delete restrict,
  candidate_run_id uuid not null,
  source_reference_id text not null,
  approval_source text not null check (approval_source in ('HUMAN_APPROVED','POLICY_APPROVED')),
  proposed_product_id uuid not null,
  business_line text not null references public.business_lines(code) on delete restrict,
  product_name text not null check (length(btrim(product_name))>0),
  brand_id uuid null references public.brands(id) on delete restrict,
  category_id uuid null,
  sale_price numeric not null check (sale_price>=0),
  image_sha256 text not null check (image_sha256 ~ '^[0-9a-f]{64}$'),
  proposed_sku text not null check (length(btrim(proposed_sku))>0),
  proposed_catalog_code text not null check (length(btrim(proposed_catalog_code))>0),
  proposed_slug text not null check (length(btrim(proposed_slug))>0),
  sku_resolution_status text not null,
  catalog_code_resolution_status text not null,
  slug_resolution_status text not null,
  product_id_resolution_status text not null,
  eligibility_status text not null check (eligibility_status in ('READY_CREATE','BLOCKED')),
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key(import_run_id,source_reference_id),
  unique(import_run_id,proposed_product_id),
  unique(import_run_id,proposed_sku),
  unique(import_run_id,proposed_catalog_code),
  unique(import_run_id,proposed_slug),
  foreign key(candidate_run_id,source_reference_id)
    references lihen_private.product_import_candidates(run_id,source_reference_id) on delete restrict,
  foreign key(category_id,business_line)
    references public.categories(id,business_line) on delete restrict
);

create table if not exists lihen_private.full_canonical_product_import_operations (
  operation_key text primary key check (length(btrim(operation_key))>0),
  actor_id uuid not null references auth.users(id) on delete restrict,
  import_run_id uuid not null references lihen_private.full_canonical_product_import_runs(id) on delete restrict,
  request_fingerprint text not null,
  status text not null check (status in ('COMPLETED','FAILED')),
  result_snapshot jsonb not null,
  completed_at timestamptz not null default now()
);

revoke all on lihen_private.full_canonical_product_import_runs from public,anon,authenticated;
revoke all on lihen_private.full_canonical_product_import_candidates from public,anon,authenticated;
revoke all on lihen_private.full_canonical_product_import_operations from public,anon,authenticated;

create or replace function lihen_private.preview_full_canonical_product_import(p_import_run_id uuid)
returns table(
  source_reference_id text,
  approval_source text,
  proposed_product_id uuid,
  proposed_sku text,
  proposed_catalog_code text,
  proposed_slug text,
  product_name text,
  business_line text,
  import_status text,
  reason text
)
language sql
security definer
set search_path=''
as $function$
with base as (
  select a.*,
    ca.approval_source as current_approval_source,
    p_id.id as existing_id,
    p_sku.id as existing_sku_id,
    p_code.id as existing_code_id,
    p_slug.id as existing_slug_id,
    b.id as existing_brand_id,
    cat.id as existing_category_id
  from lihen_private.full_canonical_product_import_candidates a
  left join lihen_private.canonical_product_approvals ca
    on ca.candidate_run_id=a.candidate_run_id
   and ca.source_reference_id=a.source_reference_id
   and ca.business_line=a.business_line
  left join public.products p_id on p_id.id=a.proposed_product_id
  left join public.products p_sku on p_sku.sku=a.proposed_sku
  left join public.products p_code on p_code.catalog_code=a.proposed_catalog_code
  left join public.products p_slug on p_slug.slug=a.proposed_slug
  left join public.brands b on b.id=a.brand_id
  left join public.categories cat on cat.id=a.category_id and cat.business_line=a.business_line
  where a.import_run_id=p_import_run_id
)
select source_reference_id,approval_source,proposed_product_id,proposed_sku,proposed_catalog_code,proposed_slug,product_name,business_line,
 case
  when current_approval_source is null then 'BLOCKED_APPROVAL_DRIFT'
  when current_approval_source is distinct from approval_source then 'BLOCKED_APPROVAL_SOURCE_DRIFT'
  when eligibility_status<>'READY_CREATE' then eligibility_status
  when brand_id is not null and existing_brand_id is null then 'BLOCKED_TAXONOMY'
  when category_id is not null and existing_category_id is null then 'BLOCKED_TAXONOMY'
  when existing_id is not null then 'CONFLICT_PRODUCT_ID'
  when existing_sku_id is not null then 'CONFLICT_SKU'
  when existing_code_id is not null then 'CONFLICT_CATALOG_CODE'
  when existing_slug_id is not null then 'CONFLICT_SLUG'
  else 'READY_CREATE'
 end,
 case
  when current_approval_source is null then 'CANONICAL_APPROVAL_NOT_FOUND'
  when current_approval_source is distinct from approval_source then 'CANONICAL_APPROVAL_SOURCE_CHANGED'
  when eligibility_status<>'READY_CREATE' then eligibility_status
  when brand_id is not null and existing_brand_id is null then 'BRAND_NOT_FOUND'
  when category_id is not null and existing_category_id is null then 'CATEGORY_BUSINESS_LINE_NOT_FOUND'
  when existing_id is not null then 'PRODUCT_ID_ALREADY_EXISTS'
  when existing_sku_id is not null then 'SKU_ALREADY_EXISTS'
  when existing_code_id is not null then 'CATALOG_CODE_ALREADY_EXISTS'
  when existing_slug_id is not null then 'SLUG_ALREADY_EXISTS'
  else 'NO_CONFLICT'
 end
from base;
$function$;

revoke execute on function lihen_private.preview_full_canonical_product_import(uuid) from public,anon,authenticated;

create or replace function public.import_full_canonical_products_controlled(
  p_operation_key text,
  p_import_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_run lihen_private.full_canonical_product_import_runs%rowtype;
  v_existing lihen_private.full_canonical_product_import_operations%rowtype;
  v_total integer; v_ready integer; v_conflicts integer; v_created integer:=0;
  v_human integer; v_policy integer;
  v_fingerprint text; v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_FULL_CANONICAL_PRODUCT_IMPORT_FORBIDDEN';
  end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  select * into v_run from lihen_private.full_canonical_product_import_runs r where r.id=p_import_run_id and r.status='COMPLETED';
  if not found then raise exception using errcode='22023',message='LIHEN_FULL_CANONICAL_IMPORT_RUN_NOT_COMPLETED'; end if;
  if v_run.scope<>'FULL_CANONICAL_APPROVED' then raise exception using errcode='22023',message='LIHEN_FULL_CANONICAL_IMPORT_SCOPE_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('LIHEN_FULL_CANONICAL_PRODUCT_IMPORT',0));

  select count(*),
         count(*) filter(where p.import_status='READY_CREATE'),
         count(*) filter(where p.import_status<>'READY_CREATE'),
         count(*) filter(where p.approval_source='HUMAN_APPROVED'),
         count(*) filter(where p.approval_source='POLICY_APPROVED')
  into v_total,v_ready,v_conflicts,v_human,v_policy
  from lihen_private.preview_full_canonical_product_import(p_import_run_id) p;

  if v_total<>v_run.canonical_approved_count
     or v_human<>v_run.human_approved_count
     or v_policy<>v_run.policy_approved_count
     or v_ready<>v_total
     or v_conflicts<>0 then
    raise exception using errcode='23505',message='LIHEN_FULL_CANONICAL_IMPORT_PREVIEW_NOT_READY';
  end if;

  v_fingerprint:=md5(concat_ws('|',p_import_run_id::text,v_total::text,v_human::text,v_policy::text,v_run.strategy_version));
  select * into v_existing from lihen_private.full_canonical_product_import_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.actor_id<>v_actor or v_existing.import_run_id<>p_import_run_id or v_existing.request_fingerprint<>v_fingerprint then
      raise exception using errcode='23505',message='LIHEN_FULL_CANONICAL_IMPORT_OPERATION_CONFLICT';
    end if;
    return v_existing.result_snapshot;
  end if;

  insert into public.products(
    id,sku,catalog_code,slug,name,business_line,brand,category,description,
    sale_price,current_cost,minimum_stock,status,visible_on_website,main_image_url,brand_id,category_id
  )
  select a.proposed_product_id,a.proposed_sku,a.proposed_catalog_code,a.proposed_slug,
         a.product_name,a.business_line,b.name,cat.name,null,
         a.sale_price,null,0,'ACTIVE',false,null,a.brand_id,a.category_id
  from lihen_private.full_canonical_product_import_candidates a
  left join public.brands b on b.id=a.brand_id
  left join public.categories cat on cat.id=a.category_id and cat.business_line=a.business_line
  where a.import_run_id=p_import_run_id and a.eligibility_status='READY_CREATE';
  get diagnostics v_created=row_count;
  if v_created<>v_total then raise exception using errcode='P0001',message='LIHEN_FULL_CANONICAL_IMPORT_CREATE_COUNT_MISMATCH'; end if;

  v_result:=jsonb_build_object(
    'import_run_id',p_import_run_id,
    'scope',v_run.scope,
    'business_line',v_run.business_line,
    'canonical_approved',v_total,
    'human_approved',v_human,
    'policy_approved',v_policy,
    'created_products',v_created,
    'completed_at',now()
  );
  insert into lihen_private.full_canonical_product_import_operations(operation_key,actor_id,import_run_id,request_fingerprint,status,result_snapshot,completed_at)
  values(btrim(p_operation_key),v_actor,p_import_run_id,v_fingerprint,'COMPLETED',v_result,now());
  return v_result;
end;
$function$;

revoke execute on function public.import_full_canonical_products_controlled(text,uuid) from public,anon,authenticated;
