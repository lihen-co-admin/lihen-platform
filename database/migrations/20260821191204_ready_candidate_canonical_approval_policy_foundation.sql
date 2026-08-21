-- FASE 1.21.5.1 — READY CANDIDATE CANONICAL APPROVAL POLICY

create table if not exists lihen_private.ready_candidate_approval_policies (
  policy_key text primary key,
  business_line text not null references public.business_lines(code) on delete restrict,
  strategy_version text not null,
  status text not null check (status in ('ACTIVE','INACTIVE')),
  criteria jsonb not null,
  created_at timestamptz not null default now(),
  check (length(btrim(policy_key)) > 0),
  check (length(btrim(strategy_version)) > 0)
);

create table if not exists lihen_private.ready_candidate_policy_approvals (
  candidate_run_id uuid not null,
  source_reference_id text not null,
  policy_key text not null references lihen_private.ready_candidate_approval_policies(policy_key) on delete restrict,
  approval_status text not null default 'APPROVED_BY_POLICY' check (approval_status = 'APPROVED_BY_POLICY'),
  evidence_snapshot jsonb not null,
  approved_at timestamptz not null default now(),
  primary key (candidate_run_id, source_reference_id, policy_key),
  foreign key (candidate_run_id, source_reference_id)
    references lihen_private.product_import_candidates(run_id, source_reference_id) on delete restrict
);

create table if not exists lihen_private.ready_candidate_policy_operations (
  operation_key text primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  candidate_run_id uuid not null references lihen_private.product_import_candidate_runs(id) on delete restrict,
  policy_key text not null references lihen_private.ready_candidate_approval_policies(policy_key) on delete restrict,
  request_fingerprint text not null,
  status text not null check (status in ('COMPLETED','FAILED')),
  result_snapshot jsonb not null,
  completed_at timestamptz not null default now()
);

revoke all on lihen_private.ready_candidate_approval_policies from public, anon, authenticated;
revoke all on lihen_private.ready_candidate_policy_approvals from public, anon, authenticated;
revoke all on lihen_private.ready_candidate_policy_operations from public, anon, authenticated;

insert into lihen_private.ready_candidate_approval_policies(policy_key,business_line,strategy_version,status,criteria)
values (
  'READY_CANDIDATE_CANONICAL_APPROVAL_V1',
  'BEAUTY_CARE',
  '1.21.5.1-V1',
  'ACTIVE',
  jsonb_build_object(
    'required_status','READY_CANDIDATE',
    'require_business_line_match',true,
    'require_no_human_decision',true,
    'require_valid_image_sha256',true,
    'require_taxonomy_anchor',true,
    'require_category_business_line_match',true,
    'require_unique_identity_across_candidate_run',true,
    'require_zero_catalog_audit_review_flags',true,
    'effect','APPROVED_BY_POLICY',
    'product_write_allowed',false
  )
)
on conflict(policy_key) do update
set business_line=excluded.business_line,
    strategy_version=excluded.strategy_version,
    status=excluded.status,
    criteria=excluded.criteria;

create or replace function lihen_private.preview_ready_candidate_policy(p_candidate_run_id uuid,p_policy_key text)
returns table(source_reference_id text,eligibility_status text,reason text)
language sql
security definer
set search_path=''
as $$
with pol as (
  select * from lihen_private.ready_candidate_approval_policies
  where policy_key=p_policy_key and status='ACTIVE'
), candidates as (
  select c.* from lihen_private.product_import_candidates c, pol p
  where c.run_id=p_candidate_run_id and c.business_line=p.business_line and c.status='READY_CANDIDATE'
), identity_counts as (
  select c.business_line,c.normalized_name,c.brand_id,c.category_id,count(*) as n
  from lihen_private.product_import_candidates c, pol p
  where c.run_id=p_candidate_run_id and c.business_line=p.business_line
  group by c.business_line,c.normalized_name,c.brand_id,c.category_id
)
select c.source_reference_id,
  case
    when exists(select 1 from lihen_private.product_import_candidate_reviews r where r.run_id=c.run_id and r.source_reference_id=c.source_reference_id) then 'BLOCKED'
    when c.image_sha256 is null or c.image_sha256 !~ '^[0-9a-f]{64}$' then 'BLOCKED'
    when c.brand_id is null and c.category_id is null then 'BLOCKED'
    when c.category_id is not null and not exists(select 1 from public.categories cat where cat.id=c.category_id and cat.business_line=c.business_line) then 'BLOCKED'
    when exists(select 1 from identity_counts i where i.business_line=c.business_line and i.normalized_name=c.normalized_name and i.brand_id is not distinct from c.brand_id and i.category_id is not distinct from c.category_id and i.n>1) then 'BLOCKED'
    when coalesce(c.reasons,'[]'::jsonb) ? 'CATALOG_AUDIT_REVIEW_REQUIRED' then 'BLOCKED'
    else 'ELIGIBLE_AUTO_APPROVE'
  end,
  case
    when exists(select 1 from lihen_private.product_import_candidate_reviews r where r.run_id=c.run_id and r.source_reference_id=c.source_reference_id) then 'HAS_HUMAN_DECISION'
    when c.image_sha256 is null or c.image_sha256 !~ '^[0-9a-f]{64}$' then 'INVALID_IMAGE_SHA256'
    when c.brand_id is null and c.category_id is null then 'MISSING_TAXONOMY_ANCHOR'
    when c.category_id is not null and not exists(select 1 from public.categories cat where cat.id=c.category_id and cat.business_line=c.business_line) then 'CATEGORY_BUSINESS_LINE_MISMATCH'
    when exists(select 1 from identity_counts i where i.business_line=c.business_line and i.normalized_name=c.normalized_name and i.brand_id is not distinct from c.brand_id and i.category_id is not distinct from c.category_id and i.n>1) then 'NON_UNIQUE_IDENTITY'
    when coalesce(c.reasons,'[]'::jsonb) ? 'CATALOG_AUDIT_REVIEW_REQUIRED' then 'CATALOG_AUDIT_REVIEW_REQUIRED'
    else 'ALL_POLICY_GATES_PASSED'
  end
from candidates c;
$$;

revoke all on function lihen_private.preview_ready_candidate_policy(uuid,text) from public,anon,authenticated;
grant execute on function lihen_private.preview_ready_candidate_policy(uuid,text) to postgres;

create or replace function public.apply_ready_candidate_approval_policy_controlled(p_operation_key text,p_candidate_run_id uuid,p_policy_key text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_existing lihen_private.ready_candidate_policy_operations%rowtype;
  v_eligible integer; v_blocked integer; v_inserted integer;
  v_fingerprint text; v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_READY_POLICY_APPROVAL_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if not exists(select 1 from lihen_private.ready_candidate_approval_policies p where p.policy_key=p_policy_key and p.status='ACTIVE') then raise exception using errcode='22023',message='LIHEN_READY_POLICY_NOT_ACTIVE'; end if;
  if not exists(select 1 from lihen_private.product_import_candidate_runs r where r.id=p_candidate_run_id and r.status='COMPLETED') then raise exception using errcode='22023',message='LIHEN_CANDIDATE_RUN_NOT_COMPLETED'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('LIHEN_READY_CANDIDATE_POLICY_APPROVAL',0));
  v_fingerprint:=md5(concat_ws('|',p_candidate_run_id::text,p_policy_key,'READY_CANDIDATE_POLICY_APPROVAL_V1'));

  select * into v_existing from lihen_private.ready_candidate_policy_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.actor_id<>v_actor or v_existing.candidate_run_id<>p_candidate_run_id or v_existing.policy_key<>p_policy_key or v_existing.request_fingerprint<>v_fingerprint or v_existing.status<>'COMPLETED' then
      raise exception using errcode='23505',message='LIHEN_READY_POLICY_OPERATION_CONFLICT';
    end if;
    return v_existing.result_snapshot;
  end if;

  select count(*) filter(where eligibility_status='ELIGIBLE_AUTO_APPROVE'), count(*) filter(where eligibility_status<>'ELIGIBLE_AUTO_APPROVE')
    into v_eligible,v_blocked
  from lihen_private.preview_ready_candidate_policy(p_candidate_run_id,p_policy_key);

  if v_blocked>0 then raise exception using errcode='22023',message='LIHEN_READY_POLICY_BLOCKED_CANDIDATES_PRESENT'; end if;
  if v_eligible=0 then raise exception using errcode='22023',message='LIHEN_READY_POLICY_NO_ELIGIBLE_CANDIDATES'; end if;

  insert into lihen_private.ready_candidate_policy_approvals(candidate_run_id,source_reference_id,policy_key,approval_status,evidence_snapshot)
  select c.run_id,c.source_reference_id,p_policy_key,'APPROVED_BY_POLICY',
    jsonb_build_object('candidate_status',c.status,'business_line',c.business_line,'normalized_name',c.normalized_name,'brand_id',c.brand_id,'category_id',c.category_id,'image_sha256',c.image_sha256,'policy_gate','ALL_POLICY_GATES_PASSED')
  from lihen_private.product_import_candidates c
  join lihen_private.preview_ready_candidate_policy(p_candidate_run_id,p_policy_key) p on p.source_reference_id=c.source_reference_id
  where c.run_id=p_candidate_run_id and p.eligibility_status='ELIGIBLE_AUTO_APPROVE'
  on conflict(candidate_run_id,source_reference_id,policy_key) do nothing;
  get diagnostics v_inserted=row_count;

  v_result:=jsonb_build_object(
    'candidate_run_id',p_candidate_run_id,'policy_key',p_policy_key,'eligible_count',v_eligible,'blocked_count',v_blocked,
    'new_approvals_inserted',v_inserted,
    'total_policy_approvals',(select count(*) from lihen_private.ready_candidate_policy_approvals a where a.candidate_run_id=p_candidate_run_id and a.policy_key=p_policy_key),
    'product_writes_executed',false,'completed_at',now()
  );
  insert into lihen_private.ready_candidate_policy_operations(operation_key,actor_id,candidate_run_id,policy_key,request_fingerprint,status,result_snapshot)
  values(btrim(p_operation_key),v_actor,p_candidate_run_id,p_policy_key,v_fingerprint,'COMPLETED',v_result);
  return v_result;
end;
$$;

revoke all on function public.apply_ready_candidate_approval_policy_controlled(text,uuid,text) from public,anon,authenticated;
grant execute on function public.apply_ready_candidate_approval_policy_controlled(text,uuid,text) to postgres;

create or replace view lihen_private.canonical_product_approvals as
select c.run_id candidate_run_id,c.source_reference_id,c.business_line,c.product_name,c.brand_id,c.category_id,c.sale_price,c.image_sha256,
       'HUMAN_APPROVED'::text approval_source,r.decided_at approved_at
from lihen_private.product_import_candidates c
join lateral (
  select d.decided_at from lihen_private.product_import_candidate_reviews d
  where d.run_id=c.run_id and d.source_reference_id=c.source_reference_id and d.decision='APPROVE_CREATE'
  order by d.decided_at desc limit 1
) r on true
union all
select c.run_id,c.source_reference_id,c.business_line,c.product_name,c.brand_id,c.category_id,c.sale_price,c.image_sha256,
       'POLICY_APPROVED'::text,a.approved_at
from lihen_private.product_import_candidates c
join lihen_private.ready_candidate_policy_approvals a on a.candidate_run_id=c.run_id and a.source_reference_id=c.source_reference_id
join lihen_private.ready_candidate_approval_policies p on p.policy_key=a.policy_key and p.status='ACTIVE';

revoke all on lihen_private.canonical_product_approvals from public,anon,authenticated;
