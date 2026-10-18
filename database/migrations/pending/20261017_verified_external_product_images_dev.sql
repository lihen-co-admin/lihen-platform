-- PREPARATION ONLY. Apply only to DEV after independent approval. No existing rows changed.
begin;
create table lihen_private.external_image_authorities (
  host text primary key check (host ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,}$'),
  evidence_id text not null check (length(evidence_id)>0),
  document_uri text not null check (length(document_uri)>0),
  expires_at timestamptz not null,
  revoked boolean not null default false
);
create table lihen_private.external_image_rights (
  document_id text primary key check (length(document_id)>0),
  document_uri text not null check (length(document_uri)>0),
  document_sha256 text not null check(document_sha256 ~ '^[a-f0-9]{64}$'),
  product_id uuid not null references public.products(id),
  source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
  commercial_use boolean not null default false,
  expires_at timestamptz not null,
  revoked boolean not null default false
);
create table lihen_private.external_image_authorizations (
  candidate_id uuid primary key,
  operation_key text not null unique check(length(operation_key)>0),
  product_id uuid not null references public.products(id),
  actor_id uuid not null references auth.users(id),
  image_id uuid not null unique,
  evidence jsonb not null,
  product_snapshot jsonb not null,
  variant_snapshot jsonb not null,
  authority_host text not null references lihen_private.external_image_authorities(host),
  rights_document_id text not null references lihen_private.external_image_rights(document_id),
  revoked boolean not null default false,
  result jsonb,
  created_at timestamptz not null default clock_timestamp()
);
revoke all on lihen_private.external_image_authorities,lihen_private.external_image_rights,
  lihen_private.external_image_authorizations from public,anon,authenticated;
grant select,insert,update on lihen_private.external_image_authorities,lihen_private.external_image_rights to service_role;
grant select on lihen_private.external_image_authorizations to service_role;

-- All service-only RPCs require a verified actor supplied by the server, never a browser envelope.
create function public.read_external_image_authorization(p_candidate_id uuid,p_operation_key text,p_actor_id uuid)
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
  if a.revoked or h.revoked or r.revoked or not r.commercial_use
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
    or e#>>'{rights,commercialUse}' is distinct from 'true'
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
  foreach k in array array['revision','sourcePageUrl','exactIdentityEvidenceId','authenticPhotographEvidenceId'] loop
    if coalesce(length(btrim(e->>k)),0)=0 then raise exception 'EXTERNAL_IMAGE_EVIDENCE_REQUIRED'; end if;
  end loop;
  if coalesce(length(e#>>'{approval,id}'),0)=0 or coalesce(length(e#>>'{approval,expiresAt}'),0)=0
    or coalesce(length(e#>>'{rights,expiresAt}'),0)=0 or coalesce(length(e#>>'{authority,expiresAt}'),0)=0
    or b->>'sourceUrl' not like 'https://'||h.host||'/%'
    or e->>'sourcePageUrl' not like 'https://'||h.host||'/%'
  then raise exception 'EXTERNAL_IMAGE_OFFICIAL_SOURCE_REQUIRED'; end if;
  return jsonb_build_object('evidence',e,'imageId',a.image_id,'result',a.result);
end $$;

create function public.approve_external_image_authorization(p_evidence jsonb,p_image_id uuid)
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
  result:=public.read_external_image_authorization((b->>'candidateId')::uuid,b->>'operationKey',(b->>'actorId')::uuid);
  return result;
end $$;

create function public.revoke_external_image_authorization(p_candidate_id uuid)
returns void language sql security definer set search_path='' as $$
  update lihen_private.external_image_authorizations set revoked=true where candidate_id=p_candidate_id;
$$;

create function public.finalize_external_product_webp(p_candidate_id uuid,p_operation_key text,p_actor_id uuid,
  p_evidence_revision text,p_sha256 text,p_byte_size bigint,p_width integer,p_height integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb; a lihen_private.external_image_authorizations%rowtype; e jsonb; b jsonb;
  source uuid; asset uuid; object_path text; image_url text; ordering integer; fingerprint jsonb; answer jsonb;
begin
  ctx:=public.read_external_image_authorization(p_candidate_id,p_operation_key,p_actor_id);
  select * into a from lihen_private.external_image_authorizations where candidate_id=p_candidate_id;
  e:=a.evidence; b:=e->'binding';
  if e->>'revision' is distinct from p_evidence_revision or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
    or p_byte_size is null or p_byte_size not between 1 and 3145728
    or p_width is null or p_height is null or least(p_width,p_height)<600
    or greatest(p_width,p_height)>4096 or p_width::bigint*p_height>8000000
  then raise exception 'EXTERNAL_IMAGE_DERIVATIVE_INVALID'; end if;
  fingerprint:=jsonb_build_object('sha256',p_sha256,'bytes',p_byte_size,'width',p_width,'height',p_height,'revision',p_evidence_revision);
  if a.result is not null then
    if a.result->'fingerprint' is distinct from fingerprint then raise exception 'EXTERNAL_IMAGE_OPERATION_CONFLICT'; end if;
    if not exists(select 1 from public.product_images i join lihen_private.product_image_storage_assets s on s.product_image_id=i.id
      where i.id=a.image_id and i.product_id=a.product_id and i.source_type='VERIFIED_EXTERNAL'
      and i.status='ACTIVE' and s.status='ACTIVE' and s.sha256=p_sha256)
    then raise exception 'EXTERNAL_IMAGE_RECONCILIATION_REQUIRED'; end if;
    return a.result||jsonb_build_object('replayed',true);
  end if;
  -- Product lock acquired by read above serializes all cooperating gallery mutations.
  if (select count(*) from public.product_images where product_id=a.product_id and source_type='VERIFIED_EXTERNAL' and status='ACTIVE')>=5
    or (select count(*) from public.product_images where product_id=a.product_id and status='ACTIVE')>=10
  then raise exception 'EXTERNAL_IMAGE_GALLERY_LIMIT'; end if;
  if exists(select 1 from lihen_private.product_image_sources s where s.product_id=a.product_id and s.sha256=b->>'sourceSha256')
    or exists(select 1 from lihen_private.product_image_storage_assets s where s.product_id=a.product_id and s.sha256=p_sha256 and s.status='ACTIVE')
  then raise exception 'EXTERNAL_IMAGE_DUPLICATE'; end if;
  object_path:='products/'||a.product_id||'/'||a.image_id||'/web/'||p_sha256||'.webp';
  image_url:='https://vnmkupzptujtywnnabkp.supabase.co/storage/v1/object/public/lihen-product-web/'||object_path;
  if not exists(select 1 from storage.objects o where o.bucket_id='lihen-product-web' and o.name=object_path
    and o.metadata->>'mimetype'='image/webp' and (o.metadata->>'size')::bigint=p_byte_size)
  then raise exception 'EXTERNAL_IMAGE_STORAGE_REQUIRED'; end if;
  insert into lihen_private.product_image_sources(product_id,source_type,source_reference_id,source_document_key,source_url,
    sha256,mime_type,width_px,height_px,byte_size,is_exact_product_match,requires_review,review_status,publication_eligibility,
    source_availability_status,created_by)
  values(a.product_id,'VERIFIED_EXTERNAL',a.candidate_id::text,a.rights_document_id,b->>'sourceUrl',b->>'sourceSha256',
    'image/png',p_width,p_height,null,true,false,'HUMAN_APPROVED','ELIGIBLE_PRIMARY','AVAILABLE',p_actor_id) returning id into source;
  select coalesce(max(sort_order),-1)+1 into ordering from public.product_images where product_id=a.product_id and status='ACTIVE';
  insert into public.product_images(id,product_id,public_url,storage_bucket,storage_path,alt_text,is_main,sort_order,source_type,status,source_id,asset_role,derivative_profile)
  values(a.image_id,a.product_id,image_url,'lihen-product-web',object_path,e->>'role',false,ordering,'VERIFIED_EXTERNAL','ACTIVE',source,'DERIVATIVE','WEB_CARD');
  insert into lihen_private.product_image_storage_assets(product_id,product_image_id,variant,bucket_id,object_path,mime_type,byte_size,sha256,width_px,height_px,status,created_by,activated_at,rendition_profile)
  values(a.product_id,a.image_id,'WEB','lihen-product-web',object_path,'image/webp',p_byte_size,p_sha256,p_width,p_height,'ACTIVE',p_actor_id,clock_timestamp(),'WEB_CARD') returning id into asset;
  answer:=jsonb_build_object('productId',a.product_id,'imageId',a.image_id,'sourceId',source,'assetId',asset,
    'publicUrl',image_url,'role',e->>'role','fingerprint',fingerprint,'replayed',false);
  update lihen_private.external_image_authorizations set result=answer where candidate_id=a.candidate_id;
  return answer;
end $$;

revoke all on function public.read_external_image_authorization(uuid,text,uuid),
  public.approve_external_image_authorization(jsonb,uuid),public.revoke_external_image_authorization(uuid),
  public.finalize_external_product_webp(uuid,text,uuid,text,text,bigint,integer,integer) from public,anon,authenticated;
grant execute on function public.read_external_image_authorization(uuid,text,uuid),
  public.approve_external_image_authorization(jsonb,uuid),public.revoke_external_image_authorization(uuid),
  public.finalize_external_product_webp(uuid,text,uuid,text,text,bigint,integer,integer) to service_role;
commit;
