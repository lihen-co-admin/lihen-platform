create table if not exists lihen_private.supplier_source_intake_operations (
  operation_key text primary key,
  operation_type text not null check (operation_type in ('REGISTER_DOCUMENT','INGEST_EXTRACTION')),
  actor_id uuid not null references auth.users(id),
  document_id uuid not null references lihen_private.supplier_source_documents(id) on delete restrict,
  request_fingerprint text not null,
  result_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table lihen_private.supplier_source_intake_operations enable row level security;
revoke all on lihen_private.supplier_source_intake_operations from public, anon, authenticated;

create or replace function public.register_supplier_source_document_controlled(
  p_operation_key text,
  p_document_id uuid,
  p_supplier_id uuid,
  p_source_name text,
  p_source_type text,
  p_source_sha256 text,
  p_source_size_bytes bigint,
  p_source_reference text,
  p_source_date date,
  p_business_line text
)
returns table(document_id uuid,status text,source_sha256 text,replayed boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_fp text;
  v_existing lihen_private.supplier_source_intake_operations%rowtype;
  v_doc lihen_private.supplier_source_documents%rowtype;
begin
  if v_actor is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then
    raise exception using errcode='42501', message='LIHEN_SUPPLIER_SOURCE_INTAKE_FORBIDDEN';
  end if;
  if p_operation_key is null or btrim(p_operation_key)='' then raise exception using errcode='22023', message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_document_id is null then raise exception using errcode='22023', message='LIHEN_SUPPLIER_SOURCE_DOCUMENT_ID_REQUIRED'; end if;
  if p_source_name is null or btrim(p_source_name)='' then raise exception using errcode='22023', message='LIHEN_SUPPLIER_SOURCE_NAME_REQUIRED'; end if;
  if p_source_type not in ('PDF','XLSX','CSV','IMAGE','OTHER') then raise exception using errcode='22023', message='LIHEN_SUPPLIER_SOURCE_TYPE_INVALID'; end if;
  if p_source_sha256 is null or p_source_sha256 !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023', message='LIHEN_SUPPLIER_SOURCE_SHA256_INVALID'; end if;
  if p_source_size_bytes is not null and p_source_size_bytes < 0 then raise exception using errcode='22023', message='LIHEN_SUPPLIER_SOURCE_SIZE_INVALID'; end if;
  if p_business_line is not null and p_business_line not in ('BEAUTY_CARE','STYLE') then raise exception using errcode='22023', message='LIHEN_BUSINESS_LINE_INVALID'; end if;
  if p_supplier_id is not null and not exists(select 1 from public.suppliers s where s.id=p_supplier_id) then raise exception using errcode='23503', message='LIHEN_SUPPLIER_NOT_FOUND'; end if;

  v_fp := md5(concat_ws('|',p_document_id::text,coalesce(p_supplier_id::text,'<NULL>'),btrim(p_source_name),p_source_type,p_source_sha256,coalesce(p_source_size_bytes::text,'<NULL>'),coalesce(nullif(btrim(p_source_reference),''),'<NULL>'),coalesce(p_source_date::text,'<NULL>'),coalesce(p_business_line,'<NULL>')));
  select * into v_existing from lihen_private.supplier_source_intake_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'REGISTER_DOCUMENT' or v_existing.actor_id<>v_actor or v_existing.document_id<>p_document_id or v_existing.request_fingerprint is distinct from v_fp then
      raise exception using errcode='23505', message='LIHEN_SUPPLIER_SOURCE_OPERATION_CONFLICT';
    end if;
    select * into v_doc from lihen_private.supplier_source_documents d where d.id=p_document_id;
    return query select v_doc.id,v_doc.status,v_doc.source_sha256,true;
    return;
  end if;

  if exists(select 1 from lihen_private.supplier_source_documents d where d.source_sha256=p_source_sha256 and d.id<>p_document_id) then raise exception using errcode='23505', message='LIHEN_SUPPLIER_SOURCE_DUPLICATE_DOCUMENT'; end if;
  if exists(select 1 from lihen_private.supplier_source_documents d where d.id=p_document_id) then raise exception using errcode='23505', message='LIHEN_SUPPLIER_SOURCE_DOCUMENT_ALREADY_EXISTS'; end if;

  insert into lihen_private.supplier_source_documents(id,supplier_id,source_name,source_type,source_sha256,source_size_bytes,source_reference,source_date,business_line,status,extraction_strategy_version,extraction_summary,evidence,candidate_run_id,created_by)
  values(p_document_id,p_supplier_id,btrim(p_source_name),p_source_type,p_source_sha256,p_source_size_bytes,nullif(btrim(coalesce(p_source_reference,'')),''),p_source_date,p_business_line,'RECEIVED',null,'{}'::jsonb,jsonb_build_object('registered_via','PHASE5_CONTROLLED_INTAKE'),null,v_actor)
  returning * into v_doc;

  insert into lihen_private.supplier_source_intake_operations(operation_key,operation_type,actor_id,document_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'REGISTER_DOCUMENT',v_actor,p_document_id,v_fp,jsonb_build_object('document_id',p_document_id,'source_sha256',p_source_sha256,'status','RECEIVED'));

  return query select v_doc.id,v_doc.status,v_doc.source_sha256,false;
end;
$function$;

create or replace function public.ingest_supplier_source_records_controlled(
  p_operation_key text,
  p_document_id uuid,
  p_strategy_version text,
  p_records jsonb
)
returns table(document_id uuid,document_status text,extracted_count integer,review_required_count integer,rejected_count integer,replayed boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_fp text;
  v_existing lihen_private.supplier_source_intake_operations%rowtype;
  v_doc lihen_private.supplier_source_documents%rowtype;
  v_record jsonb;
  v_status text;
  v_extracted integer:=0;
  v_review integer:=0;
  v_rejected integer:=0;
  v_document_status text;
  v_row_key text;
  v_confidence numeric;
begin
  if v_actor is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501', message='LIHEN_SUPPLIER_SOURCE_EXTRACTION_FORBIDDEN'; end if;
  if p_operation_key is null or btrim(p_operation_key)='' then raise exception using errcode='22023', message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_document_id is null then raise exception using errcode='22023', message='LIHEN_SUPPLIER_SOURCE_DOCUMENT_ID_REQUIRED'; end if;
  if p_strategy_version is null or btrim(p_strategy_version)='' then raise exception using errcode='22023', message='LIHEN_EXTRACTION_STRATEGY_REQUIRED'; end if;
  if p_records is null or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)=0 then raise exception using errcode='22023', message='LIHEN_SUPPLIER_SOURCE_RECORDS_REQUIRED'; end if;

  v_fp := md5(concat_ws('|',p_document_id::text,btrim(p_strategy_version),p_records::text));
  select * into v_existing from lihen_private.supplier_source_intake_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'INGEST_EXTRACTION' or v_existing.actor_id<>v_actor or v_existing.document_id<>p_document_id or v_existing.request_fingerprint is distinct from v_fp then raise exception using errcode='23505', message='LIHEN_SUPPLIER_SOURCE_OPERATION_CONFLICT'; end if;
    return query select p_document_id,v_existing.result_snapshot->>'document_status',(v_existing.result_snapshot->>'extracted_count')::integer,(v_existing.result_snapshot->>'review_required_count')::integer,(v_existing.result_snapshot->>'rejected_count')::integer,true;
    return;
  end if;

  select * into v_doc from lihen_private.supplier_source_documents d where d.id=p_document_id for update;
  if not found then raise exception using errcode='P0002',message='LIHEN_SUPPLIER_SOURCE_DOCUMENT_NOT_FOUND'; end if;
  if v_doc.status not in ('RECEIVED','EXTRACTING','REVIEW_REQUIRED') then raise exception using errcode='22023',message='LIHEN_SUPPLIER_SOURCE_DOCUMENT_NOT_EXTRACTABLE'; end if;
  if exists(select 1 from lihen_private.supplier_source_records r where r.document_id=p_document_id) then raise exception using errcode='23514',message='LIHEN_SUPPLIER_SOURCE_REEXTRACTION_REQUIRES_EXPLICIT_REVISION'; end if;

  update lihen_private.supplier_source_documents set status='EXTRACTING',extraction_strategy_version=btrim(p_strategy_version),updated_at=now() where id=p_document_id;

  for v_record in select value from jsonb_array_elements(p_records) loop
    v_row_key := nullif(btrim(coalesce(v_record->>'source_row_key','')),'');
    if v_row_key is null then raise exception using errcode='22023',message='LIHEN_SUPPLIER_SOURCE_ROW_KEY_REQUIRED'; end if;
    v_status := coalesce(nullif(v_record->>'extraction_status',''),'REVIEW_REQUIRED');
    if v_status not in ('EXTRACTED','REVIEW_REQUIRED','REJECTED') then raise exception using errcode='22023',message='LIHEN_SUPPLIER_SOURCE_EXTRACTION_STATUS_INVALID'; end if;
    if v_record ? 'extraction_confidence' and v_record->>'extraction_confidence' is not null then
      v_confidence := (v_record->>'extraction_confidence')::numeric;
      if v_confidence<0 or v_confidence>1 then raise exception using errcode='22023',message='LIHEN_SUPPLIER_SOURCE_CONFIDENCE_INVALID'; end if;
    else v_confidence := null; end if;
    if nullif(btrim(coalesce(v_record->>'product_name','')),'') is null and v_status='EXTRACTED' then v_status := 'REVIEW_REQUIRED'; end if;

    insert into lihen_private.supplier_source_records(id,document_id,source_row_key,source_page,source_slot,raw_text,supplier_reference,product_name,brand_text,category_text,subcategory_text,business_line,unit_cost,suggested_sale_price,quantity_hint,image_reference,extraction_confidence,extraction_status,evidence)
    values(coalesce(nullif(v_record->>'id','')::uuid,gen_random_uuid()),p_document_id,v_row_key,nullif(v_record->>'source_page','')::integer,nullif(v_record->>'source_slot',''),nullif(v_record->>'raw_text',''),nullif(v_record->>'supplier_reference',''),nullif(v_record->>'product_name',''),nullif(v_record->>'brand_text',''),nullif(v_record->>'category_text',''),nullif(v_record->>'subcategory_text',''),coalesce(nullif(v_record->>'business_line',''),v_doc.business_line),nullif(v_record->>'unit_cost','')::numeric,nullif(v_record->>'suggested_sale_price','')::numeric,nullif(v_record->>'quantity_hint','')::integer,nullif(v_record->>'image_reference',''),v_confidence,v_status,coalesce(v_record->'evidence','{}'::jsonb)||jsonb_build_object('ingested_via','PHASE5_CONTROLLED_EXTRACTION'));

    if v_status='EXTRACTED' then v_extracted:=v_extracted+1; elsif v_status='REVIEW_REQUIRED' then v_review:=v_review+1; else v_rejected:=v_rejected+1; end if;
  end loop;

  v_document_status := case when v_review>0 or v_rejected>0 then 'REVIEW_REQUIRED' else 'READY_FOR_CANDIDATES' end;
  update lihen_private.supplier_source_documents
  set status=v_document_status,extraction_strategy_version=btrim(p_strategy_version),
      extraction_summary=jsonb_build_object('record_count',jsonb_array_length(p_records),'extracted_count',v_extracted,'review_required_count',v_review,'rejected_count',v_rejected),
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object('extraction_completed_via','PHASE5_CONTROLLED_EXTRACTION'),updated_at=now()
  where id=p_document_id;

  insert into lihen_private.supplier_source_intake_operations(operation_key,operation_type,actor_id,document_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'INGEST_EXTRACTION',v_actor,p_document_id,v_fp,jsonb_build_object('document_status',v_document_status,'extracted_count',v_extracted,'review_required_count',v_review,'rejected_count',v_rejected));

  return query select p_document_id,v_document_status,v_extracted,v_review,v_rejected,false;
end;
$function$;

revoke all on function public.register_supplier_source_document_controlled(text,uuid,uuid,text,text,text,bigint,text,date,text) from public,anon;
revoke all on function public.ingest_supplier_source_records_controlled(text,uuid,text,jsonb) from public,anon;
grant execute on function public.register_supplier_source_document_controlled(text,uuid,uuid,text,text,text,bigint,text,date,text) to authenticated;
grant execute on function public.ingest_supplier_source_records_controlled(text,uuid,text,jsonb) to authenticated;

create or replace view public.phase5_supplier_extraction_detail
with (security_invoker=true)
as
select d.id as document_id,d.source_name,d.source_type,d.source_sha256,d.business_line,d.status,d.extraction_strategy_version,
       count(r.id)::bigint as record_count,
       count(r.id) filter(where r.extraction_status='EXTRACTED')::bigint as extracted_count,
       count(r.id) filter(where r.extraction_status='REVIEW_REQUIRED')::bigint as review_required_count,
       count(r.id) filter(where r.extraction_status='REJECTED')::bigint as rejected_count,
       case when d.status='READY_FOR_CANDIDATES' and count(r.id)>0 and count(r.id) filter(where r.extraction_status='REVIEW_REQUIRED')=0 then 'READY'
            when d.status in ('FAILED','REJECTED') then 'BLOCKED'
            when d.status in ('EXTRACTED','REVIEW_REQUIRED') then 'REVIEW'
            else 'INTAKE' end as extraction_readiness
from lihen_private.supplier_source_documents d
left join lihen_private.supplier_source_records r on r.document_id=d.id
group by d.id,d.source_name,d.source_type,d.source_sha256,d.business_line,d.status,d.extraction_strategy_version;
