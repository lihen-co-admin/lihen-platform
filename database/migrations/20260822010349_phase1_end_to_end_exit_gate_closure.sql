create table if not exists lihen_private.phase_exit_gate_results (
  phase_code text primary key check (btrim(phase_code) <> ''),
  status text not null check (status in ('PASS','BLOCKED','FAIL')),
  gate_version text not null,
  metrics jsonb not null,
  accepted_waivers jsonb not null default '[]'::jsonb,
  notes text,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now()
);

revoke all on table lihen_private.phase_exit_gate_results from public, anon, authenticated;
grant select, insert on lihen_private.phase_exit_gate_results to service_role;

insert into lihen_private.phase_exit_gate_results (
  phase_code,
  status,
  gate_version,
  metrics,
  accepted_waivers,
  notes,
  evaluated_at
)
select
  '1',
  case
    when (select count(*) from public.products) = 952
     and (select count(*) from public.product_images where status='ACTIVE' and derivative_profile='WEB_CARD') = 952
     and (select count(*) from lihen_private.product_image_storage_assets where status='ACTIVE' and rendition_profile='WEB_CARD') = 952
     and (select count(*) from lihen_private.web_image_storage_cutover_operations) = 952
     and (select count(*) from storage.objects where bucket_id='lihen-product-web') = 952
     and (select count(*) from public.products where visible_on_website) = 0
     and (select count(*) from lihen_private.legacy_reconciliation_runs where status='CUTOVER') = 1
     and (select count(*) from lihen_private.financial_ledger_entries) = 24
     and exists (
       select 1 from lihen_private.phase_exit_waivers
       where waiver_key='PHASE1_1_25_LEAKED_PASSWORD_PROTECTION_PLAN_LIMITATION'
         and status='ACCEPTED'
     )
    then 'PASS' else 'BLOCKED' end,
  'PHASE1_EXIT_GATE_V1',
  jsonb_build_object(
    'products', (select count(*) from public.products),
    'beauty_care_products', (select count(*) from public.products where business_line='BEAUTY_CARE'),
    'style_products', (select count(*) from public.products where business_line='STYLE'),
    'active_web_card_images', (select count(*) from public.product_images where status='ACTIVE' and derivative_profile='WEB_CARD'),
    'active_web_card_assets', (select count(*) from lihen_private.product_image_storage_assets where status='ACTIVE' and rendition_profile='WEB_CARD'),
    'image_cutover_operations', (select count(*) from lihen_private.web_image_storage_cutover_operations),
    'web_storage_objects', (select count(*) from storage.objects where bucket_id='lihen-product-web'),
    'visible_products', (select count(*) from public.products where visible_on_website),
    'canonical_inventory_movements', (select count(*) from public.inventory_movements),
    'canonical_on_hand', (select coalesce(sum(quantity_delta),0) from public.inventory_movements where bucket='ON_HAND'),
    'financial_ledger_entries', (select count(*) from lihen_private.financial_ledger_entries),
    'legacy_account_snapshots', (select count(*) from lihen_private.legacy_financial_account_snapshots),
    'legacy_reconciliation_runs_cutover', (select count(*) from lihen_private.legacy_reconciliation_runs where status='CUTOVER'),
    'classified_live_legacy_balances', (select count(*) from lihen_private.legacy_product_reconciliation)
  ),
  jsonb_build_array('PHASE1_1_25_LEAKED_PASSWORD_PROTECTION_PLAN_LIMITATION'),
  'Phase 1 closed after end-to-end verification. Auth leaked-password protection remains disabled and is explicitly covered by an accepted plan-limitation waiver; the waiver does not represent that control as enabled. Legacy inventory ambiguities remain quarantined and were not assigned to canonical products.',
  now()
on conflict (phase_code) do update set
  status = excluded.status,
  gate_version = excluded.gate_version,
  metrics = excluded.metrics,
  accepted_waivers = excluded.accepted_waivers,
  notes = excluded.notes,
  evaluated_at = excluded.evaluated_at;
