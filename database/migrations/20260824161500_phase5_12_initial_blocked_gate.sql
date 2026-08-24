insert into lihen_private.phase_exit_gate_results(
  phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at,created_at
)
select
  '5',
  'BLOCKED',
  'PHASE5_STOREFRONT_E2E_EXIT_GATE_V1',
  jsonb_build_object(
    'phase4_pass',exists(select 1 from lihen_private.phase_exit_gate_results g where g.phase_code='4' and g.status='PASS'),
    'phase5_2_pass',exists(select 1 from lihen_private.phase_exit_gate_results g where g.phase_code='5.2' and g.status='PASS'),
    'expected_visible_count',coalesce((select (g.metrics->>'expected_visible_count')::integer from lihen_private.phase_exit_gate_results g where g.phase_code='5.2'),0),
    'actual_visible_count',(select count(*) from public.products where visible_on_website=true),
    'storefront_projection_count',(
      select count(*) from public.products p
      where p.status='ACTIVE' and p.visible_on_website=true and p.sale_price is not null and p.sale_price>=0
        and exists(select 1 from public.product_images pi where pi.product_id=p.id and pi.status='ACTIVE' and btrim(pi.public_url)<>'')
    ),
    'outside_visible_count',coalesce((select (g.metrics->>'outside_visible_current_count')::integer from lihen_private.phase_exit_gate_results g where g.phase_code='5.2'),-1),
    'e2e_evidence_present',false,
    'e2e_result',null
  ),
  '[]'::jsonb,
  'FASE 5.12 contract installed. Gate intentionally BLOCKED until real Storefront E2E PASS evidence is registered.',
  now(),now()
on conflict (phase_code) do update set
  status=excluded.status,
  gate_version=excluded.gate_version,
  metrics=excluded.metrics,
  accepted_waivers=excluded.accepted_waivers,
  notes=excluded.notes,
  evaluated_at=excluded.evaluated_at;
