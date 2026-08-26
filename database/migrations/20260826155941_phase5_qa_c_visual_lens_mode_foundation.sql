create table if not exists lihen_private.visual_intelligence_sessions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  sku_snapshot text,
  product_name_snapshot text,
  input_type text not null default 'IMAGE' check (input_type in ('IMAGE','SCREENSHOT','CATALOG_CROP','SUPPLIER_ASSET')),
  input_asset_reference text,
  input_origin text not null default 'USER_PROVIDED' check (input_origin in ('USER_PROVIDED','INTERNAL_LIHEN','SUPPLIER_PROVIDED','CATALOG_EVIDENCE')),
  workflow_mode text not null default 'LENS_MODE' check (workflow_mode='LENS_MODE'),
  status text not null default 'RECEIVED' check (status in ('RECEIVED','SIGNALS_EXTRACTED','SEARCHING','CANDIDATES_FOUND','DECISION_READY','REVIEW_REQUIRED','RESOLVED','BLOCKED')),
  detected_product_class text,
  identity_scope text check (identity_scope is null or identity_scope in ('EXACT','FAMILY','GENERIC','SOURCE_ONLY','UNRESOLVED')),
  summary text,
  requires_human_review boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visual_intelligence_sessions_product_idx on lihen_private.visual_intelligence_sessions(product_id,created_at desc);

create table if not exists lihen_private.visual_intelligence_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references lihen_private.visual_intelligence_sessions(id) on delete cascade,
  signal_type text not null check (signal_type in ('VISIBLE_TEXT','BRAND_TOKEN','PRODUCT_TOKEN','VARIANT_TOKEN','SIZE_TOKEN','BARCODE','QR','SOCIAL_HANDLE','REFERENCE_CODE','COLOR','SHAPE','PACKAGING_FEATURE','CATEGORY_TOKEN','OTHER')),
  signal_value text not null,
  normalized_value text,
  confidence numeric check (confidence is null or (confidence>=0 and confidence<=1)),
  evidence_region jsonb,
  created_at timestamptz not null default now()
);
create index if not exists visual_intelligence_signals_session_idx on lihen_private.visual_intelligence_signals(session_id,signal_type);

create table if not exists lihen_private.visual_intelligence_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references lihen_private.visual_intelligence_sessions(id) on delete cascade,
  candidate_url text,
  source_role text not null check (source_role in ('OFFICIAL_PRODUCT','OFFICIAL_CATEGORY','OFFICIAL_CATALOG','AUTHORIZED_DISTRIBUTOR','RETAILER','MARKETPLACE','SOCIAL','OEM_GENERIC','PACKAGING_SOURCE','OTHER')),
  candidate_brand text,
  candidate_product_name text,
  candidate_variant text,
  candidate_reference_code text,
  visual_similarity numeric check (visual_similarity is null or (visual_similarity>=0 and visual_similarity<=1)),
  text_similarity numeric check (text_similarity is null or (text_similarity>=0 and text_similarity<=1)),
  variant_similarity numeric check (variant_similarity is null or (variant_similarity>=0 and variant_similarity<=1)),
  overall_confidence numeric check (overall_confidence is null or (overall_confidence>=0 and overall_confidence<=1)),
  identity_status text not null default 'UNRESOLVED' check (identity_status in ('EXACT','FAMILY','GENERIC','SOURCE_ONLY','REJECTED','UNRESOLVED')),
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED','CORROBORATED','VERIFIED','REJECTED')),
  rights_status text not null default 'UNREVIEWED' check (rights_status in ('UNREVIEWED','PUBLIC_REFERENCE_ONLY','INTERNAL_LIHEN_ASSET','USER_CONFIRMED_SUPPLIER_RIGHTS','BRAND_AUTHORIZED','REJECTED')),
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visual_intelligence_candidates_session_idx on lihen_private.visual_intelligence_candidates(session_id,overall_confidence desc);
create index if not exists visual_intelligence_candidates_identity_idx on lihen_private.visual_intelligence_candidates(identity_status,verification_status,rights_status);

create table if not exists lihen_private.visual_intelligence_decisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references lihen_private.visual_intelligence_sessions(id) on delete cascade,
  selected_candidate_id uuid references lihen_private.visual_intelligence_candidates(id) on delete set null,
  decision_status text not null check (decision_status in ('EXACT','FAMILY_VARIANT_REQUIRED','GENERIC_CONFIRMED','SOURCE_ONLY_CONFIRMED','UNRESOLVED','REJECTED','INTERNAL_USE_NOT_FOR_SALE')),
  decided_brand text,
  decided_product_name text,
  decided_variant text,
  decided_reference_code text,
  confidence numeric check (confidence is null or (confidence>=0 and confidence<=1)),
  source_mapping_status text,
  product_match_status text,
  media_discovery_status text,
  gallery_readiness_status text,
  rights_status text not null check (rights_status in ('UNREVIEWED','PUBLIC_REFERENCE_ONLY','INTERNAL_LIHEN_ASSET','USER_CONFIRMED_SUPPLIER_RIGHTS','BRAND_AUTHORIZED','REJECTED')),
  requires_human_review boolean not null default true,
  decision_reason text not null,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view lihen_private.visual_intelligence_session_summary as
select s.id session_id,s.product_id,s.sku_snapshot,s.product_name_snapshot,s.input_type,s.input_origin,s.status,s.identity_scope,s.requires_human_review,
       count(distinct sig.id) signal_count,count(distinct c.id) candidate_count,max(c.overall_confidence) best_candidate_confidence,
       d.decision_status,d.decided_brand,d.decided_product_name,d.decided_variant,d.rights_status,d.next_action,s.created_at,s.updated_at
from lihen_private.visual_intelligence_sessions s
left join lihen_private.visual_intelligence_signals sig on sig.session_id=s.id
left join lihen_private.visual_intelligence_candidates c on c.session_id=s.id
left join lihen_private.visual_intelligence_decisions d on d.session_id=s.id
group by s.id,d.id;
