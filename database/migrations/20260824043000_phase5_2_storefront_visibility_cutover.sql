create table if not exists lihen_private.storefront_visibility_cutover_runs (
  id uuid primary key default gen_random_uuid(),
  catalog_version_id uuid not null references public.catalog_versions(id),
  status text not null check (status in ('PREPARED','EXECUTED','VERIFIED')),
  prepare_operation_key text not null unique,
  execute_operation_key text unique,
  expected_source_count integer not null check (expected_source_count > 0),
  source_count integer not null default 0,
  eligible_count integer not null default 0,
  blocked_count integer not null default 0,
  already_visible_count integer not null default 0,
  outside_visible_baseline_count integer not null default 0,
  affected_count integer not null default 0,
  prepared_by uuid not null,
  prepared_at timestamptz not null default now(),
  executed_by uuid,
  executed_at timestamptz,
  verified_by uuid,
  verified_at timestamptz,
  verification_metrics jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lihen_private.storefront_visibility_cutover_candidates (
  run_id uuid not null references lihen_private.storefront_visibility_cutover_runs(id) on delete cascade,
  product_id uuid not null references public.products(id),
  source_sort_order integer not null,
  pre_visible boolean not null,
  candidate_status text not null check (candidate_status in ('ELIGIBLE','BLOCKED')),
  block_reason text,
  captured_product_status text not null,
  captured_sale_price numeric,
  captured_image_count integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (run_id, product_id)
);

alter table lihen_private.storefront_visibility_cutover_runs enable row level security;
alter table lihen_private.storefront_visibility_cutover_candidates enable row level security;

revoke all on lihen_private.storefront_visibility_cutover_runs from public, anon, authenticated;
revoke all on lihen_private.storefront_visibility_cutover_candidates from public, anon, authenticated;

create or replace function public.prepare_storefront_visibility_cutover_controlled(
  p_catalog_version_id uuid,
  p_operation_key text,
  p_expected_source_count integer
)
returns table(
  run_id uuid,
  status text,
  source_count integer,
  eligible_count integer,
  blocked_count integer,
  already_visible_count integer,
  outside_visible_baseline_count integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_run lihen_private.storefront_visibility_cutover_runs%rowtype;
  v_source_count integer;
  v_outside_baseline integer;
begin
  if v_actor_id is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_STOREFRONT_CUTOVER_FORBIDDEN';
  end if;
  if p_catalog_version_id is null then
    raise exception using errcode='22023', message='LIHEN_CATALOG_VERSION_ID_REQUIRED';
  end if;
  if p_operation_key is null or btrim(p_operation_key)='' then
    raise exception using errcode='22023', message='LIHEN_OPERATION_KEY_REQUIRED';
  end if;
  if p_expected_source_count is null or p_expected_source_count <= 0 then
    raise exception using errcode='22023', message='LIHEN_EXPECTED_SOURCE_COUNT_REQUIRED';
  end if;
  if not exists (
    select 1 from lihen_private.phase_exit_gate_results g
    where g.phase_code='4' and g.status='PASS'
  ) then
    raise exception using errcode='55000', message='LIHEN_PHASE4_NOT_CLOSED';
  end if;
  if not exists (
    select 1 from public.catalog_versions c
    where c.id=p_catalog_version_id
      and c.status='ACTIVE'
      and c.artifact_sha256 is not null
      and c.artifact_url is not null
  ) then
    raise exception using errcode='55000', message='LIHEN_STOREFRONT_SOURCE_CATALOG_NOT_PUBLISHED';
  end if;

  select r.* into v_run
  from lihen_private.storefront_visibility_cutover_runs r
  where r.prepare_operation_key=btrim(p_operation_key);

  if found then
    if v_run.catalog_version_id<>p_catalog_version_id or v_run.prepared_by<>v_actor_id or v_run.expected_source_count<>p_expected_source_count then
      raise exception using errcode='23505', message='LIHEN_STOREFRONT_CUTOVER_OPERATION_CONFLICT';
    end if;
    return query select v_run.id,v_run.status,v_run.source_count,v_run.eligible_count,v_run.blocked_count,v_run.already_visible_count,v_run.outside_visible_baseline_count;
    return;
  end if;

  select count(distinct e.product_id)::integer into v_source_count
  from public.catalog_entries e
  where e.catalog_version_id=p_catalog_version_id and e.visible=true;

  if v_source_count<>p_expected_source_count then
    raise exception using errcode='55000', message='LIHEN_STOREFRONT_SOURCE_COUNT_MISMATCH', detail=format('expected=%s actual=%s',p_expected_source_count,v_source_count);
  end if;

  select count(*)::integer into v_outside_baseline
  from public.products p
  where p.visible_on_website=true
    and not exists (
      select 1 from public.catalog_entries e
      where e.catalog_version_id=p_catalog_version_id and e.visible=true and e.product_id=p.id
    );

  insert into lihen_private.storefront_visibility_cutover_runs(
    catalog_version_id,status,prepare_operation_key,expected_source_count,source_count,
    outside_visible_baseline_count,prepared_by
  ) values (
    p_catalog_version_id,'PREPARED',btrim(p_operation_key),p_expected_source_count,v_source_count,
    v_outside_baseline,v_actor_id
  ) returning * into v_run;

  insert into lihen_private.storefront_visibility_cutover_candidates(
    run_id,product_id,source_sort_order,pre_visible,candidate_status,block_reason,
    captured_product_status,captured_sale_price,captured_image_count
  )
  select
    v_run.id,
    e.product_id,
    min(e.sort_order)::integer,
    p.visible_on_website,
    case when p.status='ACTIVE'
           and p.sale_price is not null and p.sale_price>=0
           and imgs.image_count>0
         then 'ELIGIBLE' else 'BLOCKED' end,
    case
      when p.status<>'ACTIVE' then 'PRODUCT_NOT_ACTIVE'
      when p.sale_price is null or p.sale_price<0 then 'INVALID_SALE_PRICE'
      when imgs.image_count=0 then 'MISSING_ACTIVE_CANONICAL_IMAGE'
      else null
    end,
    p.status,
    p.sale_price,
    imgs.image_count
  from public.catalog_entries e
  join public.products p on p.id=e.product_id
  cross join lateral (
    select count(*)::integer as image_count
    from public.product_images pi
    where pi.product_id=p.id and pi.status='ACTIVE' and btrim(pi.public_url)<>''
  ) imgs
  where e.catalog_version_id=p_catalog_version_id and e.visible=true
  group by e.product_id,p.visible_on_website,p.status,p.sale_price,imgs.image_count;

  update lihen_private.storefront_visibility_cutover_runs r
  set eligible_count=s.eligible_count,
      blocked_count=s.blocked_count,
      already_visible_count=s.already_visible_count,
      updated_at=now()
  from (
    select
      count(*) filter (where c.candidate_status='ELIGIBLE')::integer as eligible_count,
      count(*) filter (where c.candidate_status='BLOCKED')::integer as blocked_count,
      count(*) filter (where c.pre_visible)::integer as already_visible_count
    from lihen_private.storefront_visibility_cutover_candidates c
    where c.run_id=v_run.id
  ) s
  where r.id=v_run.id
  returning r.* into v_run;

  insert into public.operational_audit_log(id,module,operation_type,operation_key,actor_id,entity_type,entity_id,metadata)
  values(
    gen_random_uuid(),'STOREFRONT','PREPARE_VISIBILITY_CUTOVER',btrim(p_operation_key),v_actor_id,
    'STOREFRONT_VISIBILITY_CUTOVER',v_run.id,
    jsonb_build_object(
      'catalog_version_id',p_catalog_version_id,
      'source_count',v_run.source_count,
      'eligible_count',v_run.eligible_count,
      'blocked_count',v_run.blocked_count,
      'already_visible_count',v_run.already_visible_count,
      'outside_visible_baseline_count',v_run.outside_visible_baseline_count
    )
  );

  return query select v_run.id,v_run.status,v_run.source_count,v_run.eligible_count,v_run.blocked_count,v_run.already_visible_count,v_run.outside_visible_baseline_count;
end;
$function$;

create or replace function public.get_storefront_visibility_cutover_status_controlled(p_run_id uuid)
returns table(
  run_id uuid,
  catalog_version_id uuid,
  status text,
  source_count integer,
  eligible_count integer,
  blocked_count integer,
  already_visible_count integer,
  outside_visible_baseline_count integer,
  affected_count integer,
  verification_metrics jsonb
)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor_id uuid:=auth.uid();
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_STOREFRONT_CUTOVER_FORBIDDEN';
  end if;
  return query
  select r.id,r.catalog_version_id,r.status,r.source_count,r.eligible_count,r.blocked_count,r.already_visible_count,r.outside_visible_baseline_count,r.affected_count,r.verification_metrics
  from lihen_private.storefront_visibility_cutover_runs r where r.id=p_run_id;
end;
$function$;

create or replace function public.execute_storefront_visibility_cutover_controlled(
  p_run_id uuid,
  p_operation_key text
)
returns table(
  run_id uuid,
  status text,
  source_count integer,
  eligible_count integer,
  blocked_count integer,
  affected_count integer
)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor_id uuid:=auth.uid();
  v_run lihen_private.storefront_visibility_cutover_runs%rowtype;
  v_outside_now integer;
  v_revalidation_failures integer;
  v_affected integer:=0;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_STOREFRONT_CUTOVER_FORBIDDEN';
  end if;
  if p_run_id is null then raise exception using errcode='22023',message='LIHEN_CUTOVER_RUN_ID_REQUIRED'; end if;
  if p_operation_key is null or btrim(p_operation_key)='' then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;

  select r.* into v_run from lihen_private.storefront_visibility_cutover_runs r where r.id=p_run_id for update;
  if not found then raise exception using errcode='P0002',message='LIHEN_STOREFRONT_CUTOVER_RUN_NOT_FOUND'; end if;

  if v_run.execute_operation_key is not null then
    if v_run.execute_operation_key<>btrim(p_operation_key) then
      raise exception using errcode='23505',message='LIHEN_STOREFRONT_CUTOVER_EXECUTION_CONFLICT';
    end if;
    return query select v_run.id,v_run.status,v_run.source_count,v_run.eligible_count,v_run.blocked_count,v_run.affected_count;
    return;
  end if;

  if v_run.status<>'PREPARED' then raise exception using errcode='55000',message='LIHEN_STOREFRONT_CUTOVER_NOT_PREPARED'; end if;
  if v_run.source_count<>v_run.expected_source_count or v_run.blocked_count<>0 or v_run.eligible_count<>v_run.source_count then
    raise exception using errcode='55000',message='LIHEN_STOREFRONT_CUTOVER_GATE_BLOCKED';
  end if;

  select count(*)::integer into v_outside_now
  from public.products p
  where p.visible_on_website=true
    and not exists(
      select 1 from lihen_private.storefront_visibility_cutover_candidates c
      where c.run_id=v_run.id and c.product_id=p.id
    );
  if v_outside_now<>v_run.outside_visible_baseline_count then
    raise exception using errcode='55000',message='LIHEN_STOREFRONT_CUTOVER_OUTSIDE_VISIBILITY_CHANGED';
  end if;

  select count(*)::integer into v_revalidation_failures
  from lihen_private.storefront_visibility_cutover_candidates c
  join public.products p on p.id=c.product_id
  where c.run_id=v_run.id and c.candidate_status='ELIGIBLE'
    and (
      p.status<>'ACTIVE' or p.sale_price is null or p.sale_price<0
      or not exists(
        select 1 from public.product_images pi
        where pi.product_id=p.id and pi.status='ACTIVE' and btrim(pi.public_url)<>''
      )
    );
  if v_revalidation_failures<>0 then
    raise exception using errcode='55000',message='LIHEN_STOREFRONT_CUTOVER_REVALIDATION_FAILED',detail=format('failures=%s',v_revalidation_failures);
  end if;

  update public.products p
  set visible_on_website=true,updated_at=now()
  from lihen_private.storefront_visibility_cutover_candidates c
  where c.run_id=v_run.id and c.candidate_status='ELIGIBLE' and c.product_id=p.id and p.visible_on_website=false;
  get diagnostics v_affected=row_count;

  update lihen_private.storefront_visibility_cutover_runs r
  set status='EXECUTED',execute_operation_key=btrim(p_operation_key),affected_count=v_affected,
      executed_by=v_actor_id,executed_at=now(),updated_at=now()
  where r.id=v_run.id
  returning r.* into v_run;

  insert into public.operational_audit_log(id,module,operation_type,operation_key,actor_id,entity_type,entity_id,metadata)
  values(
    gen_random_uuid(),'STOREFRONT','EXECUTE_VISIBILITY_CUTOVER',btrim(p_operation_key),v_actor_id,
    'STOREFRONT_VISIBILITY_CUTOVER',v_run.id,
    jsonb_build_object('source_count',v_run.source_count,'eligible_count',v_run.eligible_count,'blocked_count',v_run.blocked_count,'affected_count',v_run.affected_count)
  );

  return query select v_run.id,v_run.status,v_run.source_count,v_run.eligible_count,v_run.blocked_count,v_run.affected_count;
end;
$function$;

create or replace function public.verify_storefront_visibility_cutover_controlled(p_run_id uuid)
returns table(
  run_id uuid,
  status text,
  expected_visible_count integer,
  actual_visible_count integer,
  missing_visible_count integer,
  outside_visible_baseline_count integer,
  outside_visible_current_count integer,
  revalidation_failure_count integer,
  storefront_projection_count integer
)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor_id uuid:=auth.uid();
  v_run lihen_private.storefront_visibility_cutover_runs%rowtype;
  v_actual integer;
  v_missing integer;
  v_outside integer;
  v_revalidation integer;
  v_projection integer;
  v_metrics jsonb;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_STOREFRONT_CUTOVER_FORBIDDEN';
  end if;

  select r.* into v_run from lihen_private.storefront_visibility_cutover_runs r where r.id=p_run_id for update;
  if not found then raise exception using errcode='P0002',message='LIHEN_STOREFRONT_CUTOVER_RUN_NOT_FOUND'; end if;
  if v_run.status not in('EXECUTED','VERIFIED') then raise exception using errcode='55000',message='LIHEN_STOREFRONT_CUTOVER_NOT_EXECUTED'; end if;

  select count(*)::integer into v_actual
  from lihen_private.storefront_visibility_cutover_candidates c
  join public.products p on p.id=c.product_id
  where c.run_id=v_run.id and c.candidate_status='ELIGIBLE' and p.visible_on_website=true;

  v_missing:=v_run.eligible_count-v_actual;

  select count(*)::integer into v_outside
  from public.products p
  where p.visible_on_website=true
    and not exists(select 1 from lihen_private.storefront_visibility_cutover_candidates c where c.run_id=v_run.id and c.product_id=p.id);

  select count(*)::integer into v_revalidation
  from lihen_private.storefront_visibility_cutover_candidates c
  join public.products p on p.id=c.product_id
  where c.run_id=v_run.id and c.candidate_status='ELIGIBLE'
    and (
      p.status<>'ACTIVE' or p.sale_price is null or p.sale_price<0
      or not exists(select 1 from public.product_images pi where pi.product_id=p.id and pi.status='ACTIVE' and btrim(pi.public_url)<>'')
    );

  select count(*)::integer into v_projection
  from public.products p
  where p.status='ACTIVE' and p.visible_on_website=true and p.sale_price is not null and p.sale_price>=0
    and exists(select 1 from public.product_images pi where pi.product_id=p.id and pi.status='ACTIVE' and btrim(pi.public_url)<>'');

  v_metrics:=jsonb_build_object(
    'run_id',v_run.id,
    'catalog_version_id',v_run.catalog_version_id,
    'expected_visible_count',v_run.eligible_count,
    'actual_visible_count',v_actual,
    'missing_visible_count',v_missing,
    'outside_visible_baseline_count',v_run.outside_visible_baseline_count,
    'outside_visible_current_count',v_outside,
    'revalidation_failure_count',v_revalidation,
    'storefront_projection_count',v_projection
  );

  if v_missing=0 and v_outside=v_run.outside_visible_baseline_count and v_revalidation=0 and v_projection=v_run.eligible_count+v_run.outside_visible_baseline_count then
    update lihen_private.storefront_visibility_cutover_runs r
    set status='VERIFIED',verified_by=v_actor_id,verified_at=coalesce(r.verified_at,now()),verification_metrics=v_metrics,updated_at=now()
    where r.id=v_run.id returning r.* into v_run;

    insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at,created_at)
    values('5.2','PASS','PHASE5_2_STOREFRONT_VISIBILITY_CUTOVER_GATE_V1',v_metrics,'[]'::jsonb,'Initial Storefront visibility cutover verified from canonical published catalog.',now(),now())
    on conflict (phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;

    if not exists(
      select 1 from public.operational_audit_log a
      where a.module='STOREFRONT' and a.operation_type='VERIFY_VISIBILITY_CUTOVER' and a.entity_id=v_run.id
    ) then
      insert into public.operational_audit_log(id,module,operation_type,operation_key,actor_id,entity_type,entity_id,metadata)
      values(gen_random_uuid(),'STOREFRONT','VERIFY_VISIBILITY_CUTOVER','verify:'||v_run.id::text,v_actor_id,'STOREFRONT_VISIBILITY_CUTOVER',v_run.id,v_metrics);
    end if;
  else
    insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at,created_at)
    values('5.2','FAIL','PHASE5_2_STOREFRONT_VISIBILITY_CUTOVER_GATE_V1',v_metrics,'[]'::jsonb,'Storefront visibility cutover verification failed.',now(),now())
    on conflict (phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
  end if;

  return query select v_run.id,v_run.status,v_run.eligible_count,v_actual,v_missing,v_run.outside_visible_baseline_count,v_outside,v_revalidation,v_projection;
end;
$function$;

revoke all on function public.prepare_storefront_visibility_cutover_controlled(uuid,text,integer) from public;
revoke all on function public.get_storefront_visibility_cutover_status_controlled(uuid) from public;
revoke all on function public.execute_storefront_visibility_cutover_controlled(uuid,text) from public;
revoke all on function public.verify_storefront_visibility_cutover_controlled(uuid) from public;

grant execute on function public.prepare_storefront_visibility_cutover_controlled(uuid,text,integer) to authenticated;
grant execute on function public.get_storefront_visibility_cutover_status_controlled(uuid) to authenticated;
grant execute on function public.execute_storefront_visibility_cutover_controlled(uuid,text) to authenticated;
grant execute on function public.verify_storefront_visibility_cutover_controlled(uuid) to authenticated;
