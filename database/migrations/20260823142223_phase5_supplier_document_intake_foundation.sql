create table if not exists lihen_private.supplier_source_documents (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete restrict,
  source_name text not null,
  source_type text not null check (source_type in ('PDF','XLSX','CSV','IMAGE','OTHER')),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_size_bytes bigint check (source_size_bytes is null or source_size_bytes >= 0),
  source_reference text,
  source_date date,
  business_line text check (business_line in ('BEAUTY_CARE','STYLE')),
  status text not null default 'RECEIVED' check (status in ('RECEIVED','EXTRACTING','EXTRACTED','REVIEW_REQUIRED','READY_FOR_CANDIDATES','REJECTED','FAILED')),
  extraction_strategy_version text,
  extraction_summary jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  candidate_run_id uuid references lihen_private.product_import_candidate_runs(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_sha256)
);

create table if not exists lihen_private.supplier_source_records (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references lihen_private.supplier_source_documents(id) on delete cascade,
  source_row_key text not null,
  source_page integer,
  source_slot text,
  raw_text text,
  supplier_reference text,
  product_name text,
  brand_text text,
  category_text text,
  subcategory_text text,
  business_line text check (business_line in ('BEAUTY_CARE','STYLE')),
  unit_cost numeric check (unit_cost is null or unit_cost >= 0),
  suggested_sale_price numeric check (suggested_sale_price is null or suggested_sale_price >= 0),
  quantity_hint integer check (quantity_hint is null or quantity_hint >= 0),
  image_reference text,
  extraction_confidence numeric check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  extraction_status text not null default 'EXTRACTED' check (extraction_status in ('EXTRACTED','REVIEW_REQUIRED','REJECTED')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, source_row_key)
);

alter table lihen_private.supplier_source_documents enable row level security;
alter table lihen_private.supplier_source_records enable row level security;

revoke all on lihen_private.supplier_source_documents from public, anon, authenticated;
revoke all on lihen_private.supplier_source_records from public, anon, authenticated;

create index if not exists supplier_source_documents_supplier_status_idx on lihen_private.supplier_source_documents(supplier_id,status);
create index if not exists supplier_source_documents_candidate_run_idx on lihen_private.supplier_source_documents(candidate_run_id);
create index if not exists supplier_source_records_document_status_idx on lihen_private.supplier_source_records(document_id,extraction_status);

create or replace view public.phase5_supplier_intake_summary
with (security_invoker=true)
as
select
  d.id as document_id,
  d.supplier_id,
  d.source_name,
  d.source_type,
  d.source_sha256,
  d.business_line,
  d.status,
  d.candidate_run_id,
  count(r.id) as extracted_records,
  count(r.id) filter (where r.extraction_status='REVIEW_REQUIRED') as review_required_records,
  count(r.id) filter (where r.extraction_status='REJECTED') as rejected_records,
  case
    when d.status in ('FAILED','REJECTED') then 'BLOCKED'
    when d.status='READY_FOR_CANDIDATES' and count(r.id)>0 and count(r.id) filter(where r.extraction_status='REVIEW_REQUIRED')=0 then 'READY'
    when d.status in ('EXTRACTED','REVIEW_REQUIRED') then 'REVIEW'
    else 'INTAKE'
  end as intake_readiness
from lihen_private.supplier_source_documents d
left join lihen_private.supplier_source_records r on r.document_id=d.id
group by d.id,d.supplier_id,d.source_name,d.source_type,d.source_sha256,d.business_line,d.status,d.candidate_run_id;

create or replace view public.phase5_entry_readiness
with (security_invoker=true)
as
with p4 as (
  select * from public.phase4_entry_readiness order by run_id desc limit 1
), diag as (
  select
    count(*) filter(where status='FAIL') as failed_checks,
    count(*) filter(where status='WARN') as warning_checks
  from public.phase4_operational_diagnostics
)
select
  p4.run_id,
  p4.phase4_readiness,
  p4.readiness_reason as phase4_reason,
  coalesce(diag.failed_checks,0) as phase4_failed_checks,
  coalesce(diag.warning_checks,0) as phase4_warning_checks,
  case
    when p4.phase4_readiness<>'READY' then 'BLOCKED'
    when coalesce(diag.failed_checks,0)>0 then 'BLOCKED'
    else 'READY'
  end as phase5_readiness,
  case
    when p4.phase4_readiness<>'READY' then 'PHASE4_ENTRY_NOT_READY'
    when coalesce(diag.failed_checks,0)>0 then 'PHASE4_OPERATIONAL_DIAGNOSTICS_FAILED'
    when coalesce(diag.warning_checks,0)>0 then 'READY_WITH_WARNINGS'
    else 'PHASE4_EXIT_GATE_PASSED'
  end as readiness_reason
from p4 cross join diag;
