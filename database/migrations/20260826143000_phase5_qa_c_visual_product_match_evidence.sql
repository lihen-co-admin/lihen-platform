create table if not exists lihen_private.visual_product_match_evidence (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku_snapshot text,
  product_name_snapshot text not null,
  internal_image_url text,
  discovery_method text not null,
  candidate_url text,
  candidate_source_role text,
  candidate_brand text,
  candidate_product_name text,
  visual_match_status text not null default 'PENDING_REVIEW',
  confidence numeric,
  verification_status text not null default 'UNVERIFIED',
  rights_status text not null default 'UNREVIEWED',
  review_basis text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'lihen_private.visual_product_match_evidence'::regclass
      and conname = 'visual_product_match_confidence_ck'
  ) then
    alter table lihen_private.visual_product_match_evidence
      add constraint visual_product_match_confidence_ck
      check (
        confidence is null
        or (confidence >= 0 and confidence <= 1)
      );
  end if;
end $$;

create index if not exists visual_product_match_product_idx
  on lihen_private.visual_product_match_evidence(product_id);

create index if not exists visual_product_match_status_idx
  on lihen_private.visual_product_match_evidence(
    visual_match_status,
    verification_status
  );

create index if not exists visual_product_match_brand_idx
  on lihen_private.visual_product_match_evidence(candidate_brand)
  where candidate_brand is not null;

create index if not exists visual_product_match_sku_idx
  on lihen_private.visual_product_match_evidence(sku_snapshot)
  where sku_snapshot is not null;

comment on table lihen_private.visual_product_match_evidence is
'QA-C / LIHEN Intelligence evidence for reverse-image and visual product matching. Evidence is non-canonical and must not publish or mutate Product Master automatically.';

comment on column lihen_private.visual_product_match_evidence.discovery_method is
'Origin of discovery, e.g. USER_REVERSE_IMAGE_SEARCH or LIHEN_VISUAL_SEARCH_QUEUE.';

comment on column lihen_private.visual_product_match_evidence.visual_match_status is
'Candidate classification such as EXACT_CANDIDATE, FAMILY_CANDIDATE, PENDING_VISUAL_SEARCH, or TEXT_SEARCH_EXHAUSTED_VISUAL_REQUIRED.';

comment on column lihen_private.visual_product_match_evidence.verification_status is
'Independent verification strength, e.g. VERIFIED, CORROBORATED, UNVERIFIED.';

comment on column lihen_private.visual_product_match_evidence.rights_status is
'Media rights state. PUBLIC_REFERENCE_ONLY does not authorize copying or publishing an external asset.';
