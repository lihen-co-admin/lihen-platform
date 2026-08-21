-- FASE 1.21.2.1 — BUSINESS LINE & DUAL-CATALOG ARCHITECTURE HARDENING
-- Canonical business lines: BEAUTY_CARE and STYLE.
-- Existing catalog/taxonomy/candidate data belongs to BEAUTY_CARE.
-- No products are created by this migration.

create table if not exists public.business_lines (
  code text primary key,
  display_name text not null,
  status text not null default 'ACTIVE',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_lines_code_not_blank check (length(btrim(code)) > 0),
  constraint business_lines_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint business_lines_status_check check (status in ('ACTIVE','INACTIVE'))
);

insert into public.business_lines(code,display_name,status,sort_order)
values
  ('BEAUTY_CARE','Beauty Care','ACTIVE',10),
  ('STYLE','Style','ACTIVE',20)
on conflict (code) do update
set display_name=excluded.display_name,
    status=excluded.status,
    sort_order=excluded.sort_order,
    updated_at=now();

alter table public.business_lines enable row level security;
revoke all on table public.business_lines from public, anon, authenticated;
grant select on table public.business_lines to authenticated;

drop policy if exists business_lines_authenticated_read on public.business_lines;
create policy business_lines_authenticated_read on public.business_lines
for select to authenticated using (true);

-- Current 5 canonical categories were approved from the final Beauty Care catalog.
update public.categories
set business_line='BEAUTY_CARE', updated_at=now()
where business_line is null;

alter table public.categories
  drop constraint if exists categories_business_line_fkey;
alter table public.categories
  add constraint categories_business_line_fkey
  foreign key (business_line) references public.business_lines(code) on delete restrict;
alter table public.categories alter column business_line set not null;

-- Product Master is still empty, so this is the safe point to make the line mandatory.
alter table public.products
  drop constraint if exists products_business_line_fkey;
alter table public.products
  add constraint products_business_line_fkey
  foreign key (business_line) references public.business_lines(code) on delete restrict;
alter table public.products alter column business_line set not null;

-- Catalog/taxonomy/product-source provenance must itself identify the commercial line.
alter table lihen_private.taxonomy_source_snapshots add column if not exists business_line text;
update lihen_private.taxonomy_source_snapshots set business_line='BEAUTY_CARE' where business_line is null;
alter table lihen_private.taxonomy_source_snapshots alter column business_line set not null;
alter table lihen_private.taxonomy_source_snapshots drop constraint if exists taxonomy_source_snapshots_business_line_fkey;
alter table lihen_private.taxonomy_source_snapshots add constraint taxonomy_source_snapshots_business_line_fkey foreign key (business_line) references public.business_lines(code) on delete restrict;

update lihen_private.taxonomy_source_records set business_line='BEAUTY_CARE' where business_line is null;
alter table lihen_private.taxonomy_source_records alter column business_line set not null;
alter table lihen_private.taxonomy_source_records drop constraint if exists taxonomy_source_records_business_line_fkey;
alter table lihen_private.taxonomy_source_records add constraint taxonomy_source_records_business_line_fkey foreign key (business_line) references public.business_lines(code) on delete restrict;

alter table lihen_private.catalog_image_evidence_sources add column if not exists business_line text;
update lihen_private.catalog_image_evidence_sources set business_line='BEAUTY_CARE' where business_line is null;
alter table lihen_private.catalog_image_evidence_sources alter column business_line set not null;
alter table lihen_private.catalog_image_evidence_sources drop constraint if exists catalog_image_evidence_sources_business_line_fkey;
alter table lihen_private.catalog_image_evidence_sources add constraint catalog_image_evidence_sources_business_line_fkey foreign key (business_line) references public.business_lines(code) on delete restrict;

alter table lihen_private.product_master_source_snapshots add column if not exists business_line text;
update lihen_private.product_master_source_snapshots set business_line='BEAUTY_CARE' where business_line is null;
alter table lihen_private.product_master_source_snapshots alter column business_line set not null;
alter table lihen_private.product_master_source_snapshots drop constraint if exists product_master_source_snapshots_business_line_fkey;
alter table lihen_private.product_master_source_snapshots add constraint product_master_source_snapshots_business_line_fkey foreign key (business_line) references public.business_lines(code) on delete restrict;

alter table lihen_private.product_master_source_records add column if not exists business_line text;
update lihen_private.product_master_source_records r
set business_line=s.business_line
from lihen_private.product_master_source_snapshots s
where r.source_key=s.source_key and r.business_line is null;
alter table lihen_private.product_master_source_records alter column business_line set not null;
alter table lihen_private.product_master_source_records drop constraint if exists product_master_source_records_business_line_fkey;
alter table lihen_private.product_master_source_records add constraint product_master_source_records_business_line_fkey foreign key (business_line) references public.business_lines(code) on delete restrict;

-- Candidate runs and every candidate carry their line explicitly.
alter table lihen_private.product_import_candidate_runs add column if not exists business_line text;
update lihen_private.product_import_candidate_runs set business_line='BEAUTY_CARE' where business_line is null;
alter table lihen_private.product_import_candidate_runs alter column business_line set not null;
alter table lihen_private.product_import_candidate_runs drop constraint if exists product_import_candidate_runs_business_line_fkey;
alter table lihen_private.product_import_candidate_runs add constraint product_import_candidate_runs_business_line_fkey foreign key (business_line) references public.business_lines(code) on delete restrict;
create unique index if not exists product_import_candidate_runs_id_business_line_uidx on lihen_private.product_import_candidate_runs(id,business_line);

alter table lihen_private.product_import_candidates add column if not exists business_line text;
update lihen_private.product_import_candidates c
set business_line=r.business_line
from lihen_private.product_import_candidate_runs r
where c.run_id=r.id and c.business_line is null;
alter table lihen_private.product_import_candidates alter column business_line set not null;
alter table lihen_private.product_import_candidates drop constraint if exists product_import_candidates_business_line_fkey;
alter table lihen_private.product_import_candidates add constraint product_import_candidates_business_line_fkey foreign key (business_line) references public.business_lines(code) on delete restrict;
alter table lihen_private.product_import_candidates drop constraint if exists product_import_candidates_run_line_fkey;
alter table lihen_private.product_import_candidates add constraint product_import_candidates_run_line_fkey foreign key (run_id,business_line) references lihen_private.product_import_candidate_runs(id,business_line) on delete restrict;

-- A category assigned to a product must belong to the same line.
create or replace function lihen_private.assert_product_category_business_line(
  p_business_line text,
  p_category_id uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_business_line is null or not exists(select 1 from public.business_lines bl where bl.code=p_business_line and bl.status='ACTIVE') then
    raise exception using errcode='22023',message='LIHEN_BUSINESS_LINE_INVALID';
  end if;
  if p_category_id is not null and not exists(
    select 1 from public.categories c where c.id=p_category_id and c.business_line=p_business_line
  ) then
    raise exception using errcode='23514',message='LIHEN_CATEGORY_BUSINESS_LINE_MISMATCH';
  end if;
end;
$$;
revoke execute on function lihen_private.assert_product_category_business_line(text,uuid) from public,anon,authenticated;


-- Review queues carry business_line explicitly. Recreate both dependent views together.
drop view if exists lihen_private.product_candidate_review_resolution_queue;
drop view if exists lihen_private.product_import_candidate_review_queue;

create view lihen_private.product_import_candidate_review_queue as
select c.run_id,c.source_reference_id,c.source_page,c.source_slot,c.product_name,c.normalized_name,c.business_line,
       c.brand_id,b.name as brand_name,c.category_id,cat.name as category_name,c.sale_price,c.image_sha256,
       c.status,c.proposed_action,c.identity_group_size,c.reasons,c.supplier_evidence,
       case c.status when 'CONFLICT' then 1 when 'REVIEW_REQUIRED' then 2 else 99 end as review_priority,
       (select count(*) from lihen_private.product_import_candidate_reviews r where r.run_id=c.run_id and r.source_reference_id=c.source_reference_id) as decision_count
from lihen_private.product_import_candidates c
left join public.brands b on b.id=c.brand_id
left join public.categories cat on cat.id=c.category_id
where c.status in ('CONFLICT','REVIEW_REQUIRED');
revoke all on lihen_private.product_import_candidate_review_queue from public,anon,authenticated;

create view lihen_private.product_candidate_review_resolution_queue as
select q.run_id,q.source_reference_id,q.source_page,q.source_slot,q.product_name,q.normalized_name,q.business_line,
       q.brand_id,q.brand_name,q.category_id,q.category_name,q.sale_price,q.image_sha256,q.status,q.proposed_action,
       q.identity_group_size,q.reasons,q.supplier_evidence,q.review_priority,q.decision_count,
       md5(concat_ws('|',q.normalized_name,coalesce(q.brand_id::text,''),coalesce(q.category_id::text,''))) as identity_key,
       g.member_count as conflict_group_size,
       lr.resolution as latest_identity_resolution,lr.canonical_source_reference_id,lr.decided_at as identity_resolved_at,
       ld.decision as latest_candidate_decision,ld.selected_product_id,ld.decided_at as candidate_decided_at
from lihen_private.product_import_candidate_review_queue q
left join lihen_private.product_candidate_identity_groups g
  on g.run_id=q.run_id and g.identity_key=md5(concat_ws('|',q.normalized_name,coalesce(q.brand_id::text,''),coalesce(q.category_id::text,'')))
left join lateral (
  select r.resolution,r.canonical_source_reference_id,r.decided_at
  from lihen_private.product_candidate_identity_resolutions r
  where r.run_id=q.run_id and r.identity_key=md5(concat_ws('|',q.normalized_name,coalesce(q.brand_id::text,''),coalesce(q.category_id::text,'')))
  order by r.decided_at desc limit 1
) lr on true
left join lateral (
  select d.decision,d.selected_product_id,d.decided_at
  from lihen_private.product_import_candidate_reviews d
  where d.run_id=q.run_id and d.source_reference_id=q.source_reference_id
  order by d.decided_at desc limit 1
) ld on true;
revoke all on lihen_private.product_candidate_review_resolution_queue from public,anon,authenticated;

revoke insert,update,delete on public.business_lines,public.categories,public.products from anon,authenticated;
