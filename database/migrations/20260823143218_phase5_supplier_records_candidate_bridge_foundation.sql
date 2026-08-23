create table if not exists lihen_private.supplier_candidate_bridge_results (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references lihen_private.supplier_source_documents(id) on delete cascade,
  source_record_id uuid not null references lihen_private.supplier_source_records(id) on delete cascade,
  candidate_run_id uuid null references lihen_private.product_import_candidate_runs(id) on delete set null,
  source_reference_id text not null,
  disposition text not null check (disposition in ('READY_CANDIDATE','EXISTING_MATCH','REVIEW_REQUIRED','REJECTED')),
  matched_product_id uuid null references public.products(id) on delete restrict,
  matched_product_count integer not null default 0 check (matched_product_count >= 0),
  resolved_brand_id uuid null references public.brands(id) on delete restrict,
  resolved_category_id uuid null references public.categories(id) on delete restrict,
  reasons jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(document_id, source_record_id)
);

alter table lihen_private.supplier_candidate_bridge_results enable row level security;
revoke all on lihen_private.supplier_candidate_bridge_results from public, anon, authenticated;

create table if not exists lihen_private.supplier_candidate_bridge_operations (
  operation_key text primary key,
  actor_id uuid not null references auth.users(id),
  document_id uuid not null references lihen_private.supplier_source_documents(id) on delete restrict,
  candidate_run_id uuid null references lihen_private.product_import_candidate_runs(id) on delete set null,
  request_fingerprint text not null,
  result_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table lihen_private.supplier_candidate_bridge_operations enable row level security;
revoke all on lihen_private.supplier_candidate_bridge_operations from public, anon, authenticated;

create or replace function public.build_supplier_product_candidates_controlled(
  p_operation_key text,
  p_document_id uuid,
  p_strategy_version text default 'phase5_supplier_bridge_v1'
)
returns table(
  document_id uuid,
  candidate_run_id uuid,
  ready_candidates integer,
  existing_matches integer,
  review_required integer,
  rejected integer,
  replayed boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_doc lihen_private.supplier_source_documents%rowtype;
  v_existing lihen_private.supplier_candidate_bridge_operations%rowtype;
  v_fp text;
  v_run_id uuid;
  v_rec lihen_private.supplier_source_records%rowtype;
  v_name_norm text;
  v_brand_norm text;
  v_category_norm text;
  v_brand_id uuid;
  v_category_id uuid;
  v_match_count integer;
  v_match_product_id uuid;
  v_match_brand_id uuid;
  v_match_category_id uuid;
  v_ready integer:=0;
  v_existing_count integer:=0;
  v_review integer:=0;
  v_rejected integer:=0;
  v_sale_price numeric;
  v_status text;
  v_action text;
  v_reasons jsonb;
  v_source_ref text;
  v_anchor_brand uuid;
  v_anchor_category uuid;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_SUPPLIER_CANDIDATE_BUILD_FORBIDDEN';
  end if;
  if p_operation_key is null or btrim(p_operation_key)='' then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_document_id is null then raise exception using errcode='22023',message='LIHEN_SUPPLIER_DOCUMENT_ID_REQUIRED'; end if;
  if p_strategy_version is null or btrim(p_strategy_version)='' then raise exception using errcode='22023',message='LIHEN_STRATEGY_VERSION_REQUIRED'; end if;

  select * into v_doc from lihen_private.supplier_source_documents d where d.id=p_document_id for update;
  if not found then raise exception using errcode='P0002',message='LIHEN_SUPPLIER_DOCUMENT_NOT_FOUND'; end if;
  if v_doc.status<>'READY_FOR_CANDIDATES' then raise exception using errcode='22023',message='LIHEN_SUPPLIER_DOCUMENT_NOT_READY_FOR_CANDIDATES'; end if;
  if v_doc.business_line is null then raise exception using errcode='22023',message='LIHEN_SUPPLIER_DOCUMENT_BUSINESS_LINE_REQUIRED'; end if;
  if not exists(select 1 from lihen_private.supplier_source_records r where r.document_id=p_document_id) then
    raise exception using errcode='22023',message='LIHEN_SUPPLIER_SOURCE_RECORDS_REQUIRED';
  end if;

  v_fp:=md5(concat_ws('|',p_document_id::text,btrim(p_strategy_version),v_doc.source_sha256,v_doc.updated_at::text));
  select * into v_existing from lihen_private.supplier_candidate_bridge_operations where operation_key=btrim(p_operation_key);
  if found then
    if v_existing.actor_id<>v_actor or v_existing.document_id<>p_document_id or v_existing.request_fingerprint is distinct from v_fp then
      raise exception using errcode='23505',message='LIHEN_SUPPLIER_CANDIDATE_OPERATION_CONFLICT';
    end if;
    return query select p_document_id,v_existing.candidate_run_id,
      coalesce((v_existing.result_snapshot->>'ready_candidates')::integer,0),
      coalesce((v_existing.result_snapshot->>'existing_matches')::integer,0),
      coalesce((v_existing.result_snapshot->>'review_required')::integer,0),
      coalesce((v_existing.result_snapshot->>'rejected')::integer,0),true;
    return;
  end if;

  if exists(select 1 from lihen_private.supplier_candidate_bridge_results b where b.document_id=p_document_id) then
    raise exception using errcode='23514',message='LIHEN_SUPPLIER_CANDIDATE_RESULTS_ALREADY_EXIST';
  end if;

  v_run_id:=gen_random_uuid();
  insert into lihen_private.product_import_candidate_runs(
    id,source_key,strategy_version,status,source_reference_count,ready_candidate_count,conflict_count,review_required_count,started_at,completed_at,created_by,business_line
  ) values (
    v_run_id,'supplier-document:'||p_document_id::text,btrim(p_strategy_version),'DRAFT',0,0,0,0,now(),null,v_actor,v_doc.business_line
  );

  for v_rec in select * from lihen_private.supplier_source_records r where r.document_id=p_document_id order by r.created_at,r.id loop
    v_source_ref := p_document_id::text||':'||v_rec.source_row_key;
    v_name_norm := lower(regexp_replace(btrim(coalesce(v_rec.product_name,'')),'\s+',' ','g'));
    v_brand_norm := lower(regexp_replace(btrim(coalesce(v_rec.brand_text,'')),'\s+',' ','g'));
    v_category_norm := lower(regexp_replace(btrim(coalesce(v_rec.category_text,'')),'\s+',' ','g'));
    v_brand_id:=null; v_category_id:=null; v_match_count:=0; v_match_product_id:=null; v_match_brand_id:=null; v_match_category_id:=null;
    v_reasons:='[]'::jsonb;

    if v_brand_norm<>'' then
      select b.id into v_brand_id from public.brands b where b.status='ACTIVE' and b.normalized_name=v_brand_norm order by b.id limit 1;
      if v_brand_id is null then v_reasons:=v_reasons||jsonb_build_array('BRAND_UNRESOLVED'); end if;
    end if;
    if v_category_norm<>'' then
      select c.id into v_category_id from public.categories c where c.status='ACTIVE' and c.business_line=v_doc.business_line and c.normalized_name=v_category_norm order by c.id limit 1;
      if v_category_id is null then v_reasons:=v_reasons||jsonb_build_array('CATEGORY_UNRESOLVED'); end if;
    end if;

    if v_name_norm<>'' then
      select count(*), min(p.id), min(p.brand_id), min(p.category_id)
      into v_match_count,v_match_product_id,v_match_brand_id,v_match_category_id
      from public.products p
      where p.status='ACTIVE'
        and p.business_line=v_doc.business_line
        and lower(regexp_replace(btrim(p.name),'\s+',' ','g'))=v_name_norm
        and (
          v_brand_norm='' or
          lower(regexp_replace(btrim(coalesce((select b.name from public.brands b where b.id=p.brand_id),p.brand,'')),'\s+',' ','g'))=v_brand_norm
        );
    end if;

    v_anchor_brand:=coalesce(v_brand_id,v_match_brand_id);
    v_anchor_category:=coalesce(v_category_id,v_match_category_id);
    v_sale_price:=coalesce(v_rec.suggested_sale_price,0);

    if v_rec.extraction_status='REJECTED' then
      insert into lihen_private.supplier_candidate_bridge_results(document_id,source_record_id,candidate_run_id,source_reference_id,disposition,matched_product_count,resolved_brand_id,resolved_category_id,reasons,evidence)
      values(p_document_id,v_rec.id,v_run_id,v_source_ref,'REJECTED',v_match_count,v_anchor_brand,v_anchor_category,v_reasons||jsonb_build_array('SOURCE_RECORD_REJECTED'),v_rec.evidence);
      v_rejected:=v_rejected+1;
      continue;
    end if;

    if v_match_count=1 then
      insert into lihen_private.supplier_candidate_bridge_results(document_id,source_record_id,candidate_run_id,source_reference_id,disposition,matched_product_id,matched_product_count,resolved_brand_id,resolved_category_id,reasons,evidence)
      values(p_document_id,v_rec.id,v_run_id,v_source_ref,'EXISTING_MATCH',v_match_product_id,1,v_anchor_brand,v_anchor_category,v_reasons||jsonb_build_array('EXACT_NORMALIZED_NAME_LINE_BRAND_MATCH'),v_rec.evidence);
      if v_anchor_brand is not null or v_anchor_category is not null then
        insert into lihen_private.product_import_candidates(run_id,source_reference_id,source_page,source_slot,product_name,normalized_name,sku,catalog_code,brand_id,category_id,sale_price,image_sha256,status,proposed_action,identity_group_size,reasons,supplier_evidence,auto_insert_allowed,business_line)
        values(v_run_id,v_source_ref,coalesce(v_rec.source_page,1),coalesce(v_rec.source_slot,v_rec.source_row_key),coalesce(nullif(btrim(v_rec.product_name),''),'UNNAMED'),v_name_norm,null,null,v_anchor_brand,v_anchor_category,v_sale_price,null,'REVIEW_REQUIRED','HOLD_FOR_REVIEW',1,
          v_reasons||jsonb_build_array('EXISTING_PRODUCT_MATCH_REQUIRES_LINK_REVIEW'),jsonb_build_object('document_id',p_document_id,'source_record_id',v_rec.id,'matched_product_id',v_match_product_id,'supplier_reference',v_rec.supplier_reference,'unit_cost',v_rec.unit_cost,'quantity_hint',v_rec.quantity_hint,'evidence',v_rec.evidence),false,v_doc.business_line);
      end if;
      v_existing_count:=v_existing_count+1;
      v_review:=v_review+1;
    elsif v_match_count>1 then
      insert into lihen_private.supplier_candidate_bridge_results(document_id,source_record_id,candidate_run_id,source_reference_id,disposition,matched_product_count,resolved_brand_id,resolved_category_id,reasons,evidence)
      values(p_document_id,v_rec.id,v_run_id,v_source_ref,'REVIEW_REQUIRED',v_match_count,v_anchor_brand,v_anchor_category,v_reasons||jsonb_build_array('MULTIPLE_CANONICAL_MATCHES'),v_rec.evidence);
      if v_anchor_brand is not null or v_anchor_category is not null then
        insert into lihen_private.product_import_candidates(run_id,source_reference_id,source_page,source_slot,product_name,normalized_name,brand_id,category_id,sale_price,status,proposed_action,identity_group_size,reasons,supplier_evidence,auto_insert_allowed,business_line)
        values(v_run_id,v_source_ref,coalesce(v_rec.source_page,1),coalesce(v_rec.source_slot,v_rec.source_row_key),coalesce(nullif(btrim(v_rec.product_name),''),'UNNAMED'),v_name_norm,v_anchor_brand,v_anchor_category,v_sale_price,'CONFLICT','HOLD_FOR_REVIEW',v_match_count,
          v_reasons||jsonb_build_array('MULTIPLE_CANONICAL_MATCHES'),jsonb_build_object('document_id',p_document_id,'source_record_id',v_rec.id,'supplier_reference',v_rec.supplier_reference,'unit_cost',v_rec.unit_cost,'evidence',v_rec.evidence),false,v_doc.business_line);
      end if;
      v_review:=v_review+1;
    elsif v_rec.extraction_status='EXTRACTED' and v_name_norm<>'' and v_rec.suggested_sale_price is not null and (v_brand_id is not null or v_category_id is not null) then
      insert into lihen_private.supplier_candidate_bridge_results(document_id,source_record_id,candidate_run_id,source_reference_id,disposition,matched_product_count,resolved_brand_id,resolved_category_id,reasons,evidence)
      values(p_document_id,v_rec.id,v_run_id,v_source_ref,'READY_CANDIDATE',0,v_brand_id,v_category_id,v_reasons||jsonb_build_array('NO_CANONICAL_MATCH_SAFE_CREATE_CANDIDATE'),v_rec.evidence);
      insert into lihen_private.product_import_candidates(run_id,source_reference_id,source_page,source_slot,product_name,normalized_name,brand_id,category_id,sale_price,status,proposed_action,identity_group_size,reasons,supplier_evidence,auto_insert_allowed,business_line)
      values(v_run_id,v_source_ref,coalesce(v_rec.source_page,1),coalesce(v_rec.source_slot,v_rec.source_row_key),btrim(v_rec.product_name),v_name_norm,v_brand_id,v_category_id,v_rec.suggested_sale_price,'READY_CANDIDATE','CREATE_PRODUCT',1,
        v_reasons||jsonb_build_array('NO_CANONICAL_MATCH_SAFE_CREATE_CANDIDATE'),jsonb_build_object('document_id',p_document_id,'source_record_id',v_rec.id,'supplier_reference',v_rec.supplier_reference,'unit_cost',v_rec.unit_cost,'quantity_hint',v_rec.quantity_hint,'image_reference',v_rec.image_reference,'extraction_confidence',v_rec.extraction_confidence,'evidence',v_rec.evidence),false,v_doc.business_line);
      v_ready:=v_ready+1;
    else
      if v_name_norm='' then v_reasons:=v_reasons||jsonb_build_array('PRODUCT_NAME_REQUIRED'); end if;
      if v_rec.suggested_sale_price is null then v_reasons:=v_reasons||jsonb_build_array('SALE_PRICE_REQUIRED_FOR_CREATE'); end if;
      if v_brand_id is null and v_category_id is null then v_reasons:=v_reasons||jsonb_build_array('TAXONOMY_ANCHOR_REQUIRED'); end if;
      if v_rec.extraction_status='REVIEW_REQUIRED' then v_reasons:=v_reasons||jsonb_build_array('SOURCE_EXTRACTION_REVIEW_REQUIRED'); end if;
      insert into lihen_private.supplier_candidate_bridge_results(document_id,source_record_id,candidate_run_id,source_reference_id,disposition,matched_product_count,resolved_brand_id,resolved_category_id,reasons,evidence)
      values(p_document_id,v_rec.id,v_run_id,v_source_ref,'REVIEW_REQUIRED',v_match_count,v_brand_id,v_category_id,v_reasons,v_rec.evidence);
      if (v_brand_id is not null or v_category_id is not null) and v_name_norm<>'' then
        insert into lihen_private.product_import_candidates(run_id,source_reference_id,source_page,source_slot,product_name,normalized_name,brand_id,category_id,sale_price,status,proposed_action,identity_group_size,reasons,supplier_evidence,auto_insert_allowed,business_line)
        values(v_run_id,v_source_ref,coalesce(v_rec.source_page,1),coalesce(v_rec.source_slot,v_rec.source_row_key),btrim(v_rec.product_name),v_name_norm,v_brand_id,v_category_id,v_sale_price,'REVIEW_REQUIRED','HOLD_FOR_REVIEW',greatest(v_match_count,1),v_reasons,
          jsonb_build_object('document_id',p_document_id,'source_record_id',v_rec.id,'supplier_reference',v_rec.supplier_reference,'unit_cost',v_rec.unit_cost,'evidence',v_rec.evidence),false,v_doc.business_line);
      end if;
      v_review:=v_review+1;
    end if;
  end loop;

  update lihen_private.product_import_candidate_runs r
  set source_reference_count=(select count(*) from lihen_private.supplier_source_records s where s.document_id=p_document_id),
      ready_candidate_count=(select count(*) from lihen_private.product_import_candidates c where c.run_id=v_run_id and c.status='READY_CANDIDATE'),
      conflict_count=(select count(*) from lihen_private.product_import_candidates c where c.run_id=v_run_id and c.status='CONFLICT'),
      review_required_count=(select count(*) from lihen_private.supplier_candidate_bridge_results b where b.candidate_run_id=v_run_id and b.disposition in ('EXISTING_MATCH','REVIEW_REQUIRED')),
      status='COMPLETED',completed_at=now()
  where r.id=v_run_id;

  update lihen_private.supplier_source_documents d set candidate_run_id=v_run_id,updated_at=now() where d.id=p_document_id;

  insert into lihen_private.supplier_candidate_bridge_operations(operation_key,actor_id,document_id,candidate_run_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),v_actor,p_document_id,v_run_id,v_fp,jsonb_build_object('ready_candidates',v_ready,'existing_matches',v_existing_count,'review_required',v_review,'rejected',v_rejected));

  return query select p_document_id,v_run_id,v_ready,v_existing_count,v_review,v_rejected,false;
end;$function$;

revoke all on function public.build_supplier_product_candidates_controlled(text,uuid,text) from public,anon;
grant execute on function public.build_supplier_product_candidates_controlled(text,uuid,text) to authenticated;

create or replace view public.phase5_supplier_candidate_bridge_summary
with (security_invoker=true)
as
select d.id as document_id,d.source_name,d.status as document_status,d.candidate_run_id,
       count(b.*) as source_records_processed,
       count(b.*) filter(where b.disposition='READY_CANDIDATE') as ready_candidates,
       count(b.*) filter(where b.disposition='EXISTING_MATCH') as existing_matches,
       count(b.*) filter(where b.disposition='REVIEW_REQUIRED') as review_required,
       count(b.*) filter(where b.disposition='REJECTED') as rejected,
       case when d.candidate_run_id is null then 'WAITING_FOR_CANDIDATE_BUILD'
            when count(b.*) filter(where b.disposition='REVIEW_REQUIRED')>0 or count(b.*) filter(where b.disposition='EXISTING_MATCH')>0 then 'REVIEW'
            when count(b.*) filter(where b.disposition='READY_CANDIDATE')>0 then 'READY_FOR_DECISION'
            else 'EMPTY' end as bridge_readiness
from lihen_private.supplier_source_documents d
left join lihen_private.supplier_candidate_bridge_results b on b.document_id=d.id
group by d.id,d.source_name,d.status,d.candidate_run_id;
