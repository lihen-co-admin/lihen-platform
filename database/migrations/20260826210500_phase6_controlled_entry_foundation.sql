create or replace view lihen_private.phase6_entry_readiness as
select
  case
    when f.closure_status = 'PASS'
      and f.visual_regression_failed = 0
      and f.eugym_bridge_results = 23
      and f.eugym_existing_matches = 23
      and f.eugym_ready_candidates = 0
      and f.eugym_review_required = 0
      and f.eugym_rejected = 0
      and f.style_visible_products = 0
    then 'PASS'
    else 'BLOCKED'
  end as entry_status,
  f.closure_status as phase5_closure_status,
  f.media_content_debt_status,
  f.visible_active_products,
  f.no_media_products,
  f.web_detail_products,
  f.gallery_ready_products,
  f.visual_regression_total,
  f.visual_regression_pass,
  f.visual_regression_failed,
  f.eugym_bridge_results,
  f.eugym_existing_matches,
  f.eugym_ready_candidates,
  f.eugym_review_required,
  f.eugym_rejected,
  f.style_active_products,
  f.style_visible_products,
  f.non_blocking_debt as inherited_non_blocking_debt,
  jsonb_build_object(
    'phase6_scope', jsonb_build_array(
      'CONTROLLED_OPERATIONALIZATION',
      'ADMIN_WORKFLOWS',
      'COMMERCIAL_AND_INVENTORY_SAFETY',
      'OBSERVABILITY_AND_AUDITABILITY',
      'PROGRESSIVE_MEDIA_ENRICHMENT_WITHOUT_FABRICATION'
    ),
    'entry_invariants', jsonb_build_array(
      'PRODUCT_MASTER_REMAINS_CANONICAL',
      'NO_STYLE_AUTO_PUBLICATION',
      'NO_EXTERNAL_MEDIA_COPY_WITHOUT_RIGHTS',
      'NO_PRODUCTION_WRITES_FROM_PHASE6_ENTRY',
      'PRICE_HISTORY_REMAINS_APPEND_ONLY',
      'HUMAN_REVIEW_REQUIRED_FOR_AMBIGUOUS_IDENTITY'
    )
  ) as phase6_contract
from lihen_private.phase5_final_closure_audit f;

revoke all on lihen_private.phase6_entry_readiness from public, anon, authenticated;
grant select on lihen_private.phase6_entry_readiness to postgres;

create or replace function public.get_phase6_entry_readiness_controlled()
returns setof lihen_private.phase6_entry_readiness
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=v_actor
      and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_PHASE6_ENTRY_READ_FORBIDDEN';
  end if;
  return query select * from lihen_private.phase6_entry_readiness;
end;
$$;

revoke all on function public.get_phase6_entry_readiness_controlled() from public, anon;
grant execute on function public.get_phase6_entry_readiness_controlled() to authenticated, postgres;

insert into lihen_private.phase_exit_gate_results(
  phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at
)
select
  '6.0',
  case when e.entry_status='PASS' then 'PASS' else 'BLOCKED' end,
  'PHASE6_CONTROLLED_ENTRY_V1',
  jsonb_build_object(
    'phase5_closure_status', e.phase5_closure_status,
    'media_content_debt_status', e.media_content_debt_status,
    'visible_active_products', e.visible_active_products,
    'visual_regression_failed', e.visual_regression_failed,
    'eugym_bridge_results', e.eugym_bridge_results,
    'eugym_existing_matches', e.eugym_existing_matches,
    'style_active_products', e.style_active_products,
    'style_visible_products', e.style_visible_products,
    'inherited_non_blocking_debt', e.inherited_non_blocking_debt,
    'phase6_contract', e.phase6_contract
  ),
  '[]'::jsonb,
  'FASE 6 entry only. No production writes, no STYLE publication, and inherited progressive debt remains explicit.',
  now()
from lihen_private.phase6_entry_readiness e
on conflict (phase_code) do update
set status=excluded.status,
    gate_version=excluded.gate_version,
    metrics=excluded.metrics,
    accepted_waivers=excluded.accepted_waivers,
    notes=excluded.notes,
    evaluated_at=excluded.evaluated_at;
