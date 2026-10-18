-- Incremental DEV-only synthetic acceptance support. Does not change the applied migration.
-- No Storage policies, buckets, existing rows, commercial validators or commercial RPCs changed.
begin;
create table lihen_private.synthetic_image_test_results (
 candidate_id uuid primary key references lihen_private.external_image_authorizations(candidate_id),
 product_id uuid not null unique references public.products(id),
 image_id uuid not null unique, source_type text not null check(source_type='SYNTHETIC_TEST'),
 source_sha256 text not null check(source_sha256='8a2364c06d4a91acf5a65329a5f4a4701cbf911fab22c24d55202f69f1c294a6'),
 bucket_id text not null check(bucket_id='lihen-product-originals'), object_path text not null unique,
 fingerprint jsonb not null, created_at timestamptz not null default clock_timestamp(),
 check(product_id='8ebc8ca4-7c42-4e85-b42c-fbb218327101'::uuid)
);
revoke all on lihen_private.synthetic_image_test_results from public,anon,authenticated,service_role;
grant select on lihen_private.synthetic_image_test_results to service_role;

create function lihen_private.assert_synthetic_test(e jsonb,p jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare approved timestamptz:=(e#>>'{synthetic,approvedAt}')::timestamptz;
 expiry timestamptz:=(e#>>'{approval,expiresAt}')::timestamptz;
begin
 -- PostgREST supplies verified service JWT claims; no caller-provided project parameter.
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'ref' is distinct from 'vnmkupzptujtywnnabkp'
  or e->>'mode' is distinct from 'SYNTHETIC_TEST'
  or e#>>'{binding,productId}' is distinct from '8ebc8ca4-7c42-4e85-b42c-fbb218327101'
  or e#>>'{binding,sourceSha256}' is distinct from '8a2364c06d4a91acf5a65329a5f4a4701cbf911fab22c24d55202f69f1c294a6'
  or e#>>'{binding,sku}' is distinct from 'SYNTHETIC-WEBP-DEV-20261017-01'
  or p->>'id' is distinct from '8ebc8ca4-7c42-4e85-b42c-fbb218327101'
  or p->>'sku' is distinct from 'SYNTHETIC-WEBP-DEV-20261017-01'
  or p->>'status' is distinct from 'INACTIVE' or p->>'visible_on_website' is distinct from 'false'
  or p->>'main_image_url' is not null
  or e#>>'{synthetic,humanTestApproval}' is distinct from 'true'
  or coalesce(e#>>'{synthetic,provenanceDocumentId}','')='' or coalesce(e#>>'{synthetic,documentSha256}','') !~ '^[a-f0-9]{64}$'
  or coalesce(e->>'authenticPhotographEvidenceId','')<>'' or coalesce(e->>'exactIdentityEvidenceId','')<>''
  or approved is null or expiry is null or approved>clock_timestamp() or approved<clock_timestamp()-interval '30 minutes'
  or expiry<=clock_timestamp() or expiry>approved+interval '30 minutes'
 then raise exception 'SYNTHETIC_TEST_INVALID'; end if;
end $$;
revoke all on function lihen_private.assert_synthetic_test(jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.read_synthetic_image_authorization(p_candidate_id uuid,p_operation_key text,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a lihen_private.external_image_authorizations%rowtype; p public.products%rowtype;
  h lihen_private.external_image_authorities%rowtype; r lihen_private.external_image_rights%rowtype;
  e jsonb; b jsonb; k text; variants jsonb; identity_now jsonb;
begin
  select * into a from lihen_private.external_image_authorizations where candidate_id=p_candidate_id for update;
  if not found or a.operation_key is distinct from p_operation_key or a.actor_id is distinct from p_actor_id then raise exception 'EXTERNAL_IMAGE_OPERATION_CONFLICT'; end if;
  select * into p from public.products where id=a.product_id for update;
  perform 1 from public.product_variants where product_id=a.product_id order by id for update;
  select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]'::jsonb) into variants from public.product_variants v where v.product_id=a.product_id;
  select jsonb_object_agg(key,value) into identity_now from jsonb_each(to_jsonb(p))
    where key in ('id','sku','catalog_code','name','brand_id','business_line','updated_at');
  select * into h from lihen_private.external_image_authorities where host=a.authority_host for update;
  select * into r from lihen_private.external_image_rights where document_id=a.rights_document_id for update;
  e:=a.evidence; b:=e->'binding';
  perform lihen_private.assert_synthetic_test(e,to_jsonb(p));
  if e#>>'{synthetic,provenanceDocumentId}' is distinct from r.document_id
    or e#>>'{synthetic,documentSha256}' is distinct from r.document_sha256
    or a.created_at + interval '30 minutes' < (e#>>'{approval,expiresAt}')::timestamptz
  then raise exception 'SYNTHETIC_DOCUMENT_OR_LIFETIME_INVALID'; end if;
  if a.revoked or h.revoked or r.revoked or r.commercial_use
    or a.product_snapshot is distinct from identity_now or a.variant_snapshot is distinct from variants
    or (jsonb_array_length(variants)>0 and not exists(select 1 from public.product_variants v
      where v.product_id=a.product_id and v.variant_code=b->>'variant' and v.presentation=b->>'presentation' and v.tone=b->>'tone'))
    or h.expires_at<=clock_timestamp() or r.expires_at<=clock_timestamp()
    or (e#>>'{authority,expiresAt}')::timestamptz<=clock_timestamp()
    or (e#>>'{rights,expiresAt}')::timestamptz<=clock_timestamp()
    or (e#>>'{approval,expiresAt}')::timestamptz<=clock_timestamp()
    or e#>>'{authority,revoked}' is distinct from 'false'
    or e#>>'{rights,revoked}' is distinct from 'false'
    or e#>>'{approval,revoked}' is distinct from 'false'
    or e#>>'{rights,commercialUse}' is distinct from 'false'
    or e#>>'{authority,evidenceId}' is distinct from h.evidence_id
    or r.product_id is distinct from a.product_id or r.source_sha256 is distinct from b->>'sourceSha256'
    or b->>'productId' is distinct from a.product_id::text or b->>'actorId' is distinct from a.actor_id::text
    or b->>'candidateId' is distinct from a.candidate_id::text or b->>'operationKey' is distinct from a.operation_key
    or b->>'sku' is distinct from p.sku or b->>'productVersion' is distinct from p.updated_at::text
    or e#>'{approval,binding}' is distinct from b or e->'contradictions' is distinct from '[]'::jsonb
    or b->>'sourceSha256' !~ '^[a-f0-9]{64}$'
    or coalesce(e->>'role','') not in ('FRONT','BACK','ANGLE','DETAIL','IN_USE')
    or not exists(select 1 from public.profiles where id=p_actor_id and authorization_status='ACTIVE' and role_code in ('OWNER','ADMIN'))
    or not exists(select 1 from public.profiles where id=(e#>>'{approval,reviewerId}')::uuid and authorization_status='ACTIVE' and role_code in ('OWNER','ADMIN'))
  then raise exception 'EXTERNAL_IMAGE_AUTHORIZATION_INVALID'; end if;
  foreach k in array array['sku','reference','presentation','tone','variant','productVersion','sourceUrl','sourceSha256'] loop
    if coalesce(length(btrim(b->>k)),0)=0 then raise exception 'EXTERNAL_IMAGE_IDENTITY_REQUIRED'; end if;
  end loop;
  foreach k in array array['revision','sourcePageUrl'] loop
    if coalesce(length(btrim(e->>k)),0)=0 then raise exception 'EXTERNAL_IMAGE_EVIDENCE_REQUIRED'; end if;
  end loop;
  if coalesce(length(e#>>'{approval,id}'),0)=0 or coalesce(length(e#>>'{approval,expiresAt}'),0)=0
    or coalesce(length(e#>>'{rights,expiresAt}'),0)=0 or coalesce(length(e#>>'{authority,expiresAt}'),0)=0
    or b->>'sourceUrl' not like 'https://'||h.host||'/%'
    or e->>'sourcePageUrl' not like 'https://'||h.host||'/%'
  then raise exception 'EXTERNAL_IMAGE_OFFICIAL_SOURCE_REQUIRED'; end if;
  return jsonb_build_object('evidence',e,'imageId',a.image_id,'result',a.result);
end $$;


create function public.approve_synthetic_image_authorization(p_evidence jsonb,p_image_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b jsonb:=p_evidence->'binding'; a lihen_private.external_image_authorizations%rowtype; result jsonb;
  identity_now jsonb; variants jsonb;
begin
  -- Idempotent approval creation; a changed envelope never replaces an earlier approval.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(b->>'operationKey',0));
  select * into a from lihen_private.external_image_authorizations where operation_key=b->>'operationKey';
  if found then
    if a.evidence is distinct from p_evidence or a.image_id is distinct from p_image_id then raise exception 'EXTERNAL_IMAGE_OPERATION_CONFLICT'; end if;
  else
    perform 1 from public.products where id=(b->>'productId')::uuid for update;
    perform 1 from public.product_variants where product_id=(b->>'productId')::uuid order by id for update;
    select jsonb_object_agg(key,value) into identity_now from public.products p,jsonb_each(to_jsonb(p))
      where p.id=(b->>'productId')::uuid and key in ('id','sku','catalog_code','name','brand_id','business_line','updated_at');
    select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]'::jsonb) into variants from public.product_variants v where v.product_id=(b->>'productId')::uuid;
    insert into lihen_private.external_image_authorizations(candidate_id,operation_key,product_id,actor_id,image_id,evidence,product_snapshot,variant_snapshot,authority_host,rights_document_id)
    values((b->>'candidateId')::uuid,b->>'operationKey',(b->>'productId')::uuid,(b->>'actorId')::uuid,p_image_id,p_evidence,identity_now,variants,p_evidence#>>'{authority,host}',p_evidence#>>'{rights,documentId}');
  end if;
  result:=public.read_synthetic_image_authorization((b->>'candidateId')::uuid,b->>'operationKey',(b->>'actorId')::uuid);
  return result;
end $$;


create function public.finalize_synthetic_product_webp(p_candidate_id uuid,p_operation_key text,p_actor_id uuid,
 p_evidence_revision text,p_sha256 text,p_byte_size bigint,p_width integer,p_height integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb; a lihen_private.external_image_authorizations%rowtype; fp jsonb; path text; answer jsonb;
begin
 ctx:=public.read_synthetic_image_authorization(p_candidate_id,p_operation_key,p_actor_id);
 select * into a from lihen_private.external_image_authorizations where candidate_id=p_candidate_id;
 if a.evidence->>'revision' is distinct from p_evidence_revision or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
  or p_byte_size is null or p_byte_size not between 1 and 3145728
  or p_width is distinct from 600 or p_height is distinct from 600
 then raise exception 'SYNTHETIC_DERIVATIVE_INVALID'; end if;
 fp:=jsonb_build_object('sha256',p_sha256,'bytes',p_byte_size,'width',p_width,'height',p_height,'revision',p_evidence_revision);
 path:='_synthetic_tests/'||a.product_id||'/'||a.image_id||'/web/'||p_sha256||'.webp';
 if not exists(select 1 from storage.buckets where id='lihen-product-originals' and public=false)
  or not exists(select 1 from storage.objects where bucket_id='lihen-product-originals' and name=path
   and metadata->>'mimetype'='image/webp' and (metadata->>'size')::bigint=p_byte_size)
 then raise exception 'SYNTHETIC_PRIVATE_STORAGE_REQUIRED'; end if;
 if a.result is not null then
  if a.result->'fingerprint' is distinct from fp or not exists(select 1 from lihen_private.synthetic_image_test_results
   where candidate_id=p_candidate_id and fingerprint=fp and object_path=path)
  then raise exception 'SYNTHETIC_OPERATION_CONFLICT'; end if;
  return a.result||jsonb_build_object('replayed',true);
 end if;
 if exists(select 1 from lihen_private.synthetic_image_test_results where product_id=a.product_id)
 then raise exception 'SYNTHETIC_DUPLICATE'; end if;
 insert into lihen_private.synthetic_image_test_results(candidate_id,product_id,image_id,source_type,source_sha256,bucket_id,object_path,fingerprint)
 values(p_candidate_id,a.product_id,a.image_id,'SYNTHETIC_TEST',a.evidence#>>'{binding,sourceSha256}','lihen-product-originals',path,fp);
 answer:=jsonb_build_object('productId',a.product_id,'imageId',a.image_id,'sourceType','SYNTHETIC_TEST',
 'bucket','lihen-product-originals','objectPath',path,'commercialEligible',false,'fingerprint',fp,'replayed',false);
 update lihen_private.external_image_authorizations set result=answer where candidate_id=p_candidate_id;
 return answer;
end $$;

create function lihen_private.block_synthetic_commercial_publication()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_schema='public' and tg_table_name='products' then
  if tg_op='UPDATE' and old.id='8ebc8ca4-7c42-4e85-b42c-fbb218327101'::uuid and new.id is distinct from old.id
  then raise exception 'SYNTHETIC_PUBLICATION_FORBIDDEN'; end if;
  if new.id='8ebc8ca4-7c42-4e85-b42c-fbb218327101'::uuid and
   (new.status is distinct from 'INACTIVE' or new.visible_on_website is distinct from false
    or new.main_image_url is not null or new.sku is distinct from 'SYNTHETIC-WEBP-DEV-20261017-01')
  then raise exception 'SYNTHETIC_PUBLICATION_FORBIDDEN'; end if;
 elsif new.product_id='8ebc8ca4-7c42-4e85-b42c-fbb218327101'::uuid then
  raise exception 'SYNTHETIC_PUBLICATION_FORBIDDEN';
 end if;
 return new;
end $$;
revoke all on function lihen_private.block_synthetic_commercial_publication() from public,anon,authenticated,service_role;
create trigger synthetic_product_not_public before insert or update on public.products
 for each row execute function lihen_private.block_synthetic_commercial_publication();
create trigger synthetic_no_commercial_images before insert or update on public.product_images
 for each row execute function lihen_private.block_synthetic_commercial_publication();
create trigger synthetic_no_commercial_sources before insert or update on lihen_private.product_image_sources
 for each row execute function lihen_private.block_synthetic_commercial_publication();
create trigger synthetic_no_catalog_entries before insert or update on public.catalog_entries
 for each row execute function lihen_private.block_synthetic_commercial_publication();

revoke all on function public.read_synthetic_image_authorization(uuid,text,uuid),
 public.approve_synthetic_image_authorization(jsonb,uuid),public.finalize_synthetic_product_webp(uuid,text,uuid,text,text,bigint,integer,integer)
 from public,anon,authenticated;
grant execute on function public.read_synthetic_image_authorization(uuid,text,uuid),
 public.approve_synthetic_image_authorization(jsonb,uuid),public.finalize_synthetic_product_webp(uuid,text,uuid,text,text,bigint,integer,integer)
 to service_role;
commit;
