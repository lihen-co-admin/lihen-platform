create table if not exists lihen_private.web_image_storage_cutover_operations (
  operation_key text primary key,
  request_fingerprint text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  product_image_id uuid not null,
  source_id uuid not null references lihen_private.product_image_sources(id) on delete restrict,
  bucket_id text not null,
  object_path text not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint web_image_storage_cutover_operation_key_not_blank check (length(btrim(operation_key)) > 0),
  constraint web_image_storage_cutover_fingerprint_check check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  constraint web_image_storage_cutover_bucket_check check (bucket_id = 'lihen-product-web'),
  constraint web_image_storage_cutover_product_image_unique unique (product_image_id),
  constraint web_image_storage_cutover_bucket_path_unique unique (bucket_id, object_path)
);

revoke all on table lihen_private.web_image_storage_cutover_operations from public, anon, authenticated;
grant select, insert on table lihen_private.web_image_storage_cutover_operations to service_role;

create or replace function public.finalize_web_image_storage_cutover(
  p_operation_key text,
  p_product_image_id uuid,
  p_product_id uuid,
  p_source_reference_id text,
  p_bucket_id text,
  p_object_path text,
  p_public_url text,
  p_mime_type text,
  p_byte_size bigint,
  p_sha256 text,
  p_width_px integer,
  p_height_px integer
)
returns table (
  product_image_id uuid,
  product_id uuid,
  source_id uuid,
  storage_asset_id uuid,
  storage_bucket text,
  storage_path text,
  public_url text,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_source lihen_private.product_image_sources%rowtype;
  v_existing_op lihen_private.web_image_storage_cutover_operations%rowtype;
  v_existing_image public.product_images%rowtype;
  v_existing_asset lihen_private.product_image_storage_assets%rowtype;
  v_asset_id uuid;
  v_product_name text;
  v_expected_path text;
  v_fingerprint text;
begin
  if p_operation_key is null or length(btrim(p_operation_key)) = 0 then
    raise exception using errcode='22023', message='LIHEN_WEB_IMAGE_OPERATION_KEY_REQUIRED';
  end if;
  if p_product_image_id is null or p_product_id is null then
    raise exception using errcode='22023', message='LIHEN_WEB_IMAGE_ID_REQUIRED';
  end if;
  if p_source_reference_id is null or length(btrim(p_source_reference_id)) = 0 then
    raise exception using errcode='22023', message='LIHEN_WEB_IMAGE_SOURCE_REFERENCE_REQUIRED';
  end if;
  if p_bucket_id <> 'lihen-product-web' then
    raise exception using errcode='22023', message='LIHEN_WEB_IMAGE_BUCKET_INVALID';
  end if;
  if p_mime_type <> 'image/webp' then
    raise exception using errcode='22023', message='LIHEN_WEB_IMAGE_MIME_INVALID';
  end if;
  if p_byte_size is null or p_byte_size <= 0 or p_byte_size > 3145728 then
    raise exception using errcode='22023', message='LIHEN_WEB_IMAGE_SIZE_INVALID';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023', message='LIHEN_WEB_IMAGE_SHA256_INVALID';
  end if;
  if p_width_px is null or p_width_px <= 0 or p_height_px is null or p_height_px <= 0 then
    raise exception using errcode='22023', message='LIHEN_WEB_IMAGE_DIMENSIONS_INVALID';
  end if;

  v_expected_path := 'products/' || p_product_id::text || '/' || p_product_image_id::text || '/web/' || p_sha256 || '.webp';
  if p_object_path is distinct from v_expected_path then
    raise exception using errcode='22023', message='LIHEN_WEB_IMAGE_PATH_INVALID';
  end if;
  if p_public_url is null or p_public_url not like '%/storage/v1/object/public/lihen-product-web/' || v_expected_path then
    raise exception using errcode='22023', message='LIHEN_WEB_IMAGE_PUBLIC_URL_INVALID';
  end if;

  select s.* into v_source
  from lihen_private.product_image_sources s
  where s.product_id = p_product_id
    and s.source_reference_id = btrim(p_source_reference_id)
    and s.source_type = 'CATALOG_EVIDENCE_CROP'
    and s.is_exact_product_match = true
    and s.requires_review = false
    and s.review_status in ('EVIDENCE_ACCEPTED','HUMAN_APPROVED')
    and s.publication_eligibility in ('FALLBACK_ONLY','ELIGIBLE_PRIMARY')
  order by s.created_at asc
  limit 1;
  if not found then
    raise exception using errcode='P0002', message='LIHEN_WEB_IMAGE_PROVENANCE_SOURCE_NOT_ELIGIBLE';
  end if;

  select p.name into v_product_name from public.products p where p.id=p_product_id for update;
  if not found then
    raise exception using errcode='P0002', message='LIHEN_PRODUCT_NOT_FOUND';
  end if;

  v_fingerprint := md5(concat_ws('|',
    p_product_image_id::text,p_product_id::text,v_source.id::text,btrim(p_source_reference_id),
    p_bucket_id,p_object_path,p_public_url,p_mime_type,p_byte_size::text,p_sha256,p_width_px::text,p_height_px::text
  ));

  select o.* into v_existing_op
  from lihen_private.web_image_storage_cutover_operations o
  where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing_op.request_fingerprint is distinct from v_fingerprint
       or v_existing_op.product_id <> p_product_id
       or v_existing_op.product_image_id <> p_product_image_id
       or v_existing_op.source_id <> v_source.id
       or v_existing_op.bucket_id <> p_bucket_id
       or v_existing_op.object_path <> p_object_path then
      raise exception using errcode='23505', message='LIHEN_WEB_IMAGE_OPERATION_CONFLICT';
    end if;
    return query select
      (v_existing_op.result_snapshot->>'product_image_id')::uuid,
      (v_existing_op.result_snapshot->>'product_id')::uuid,
      (v_existing_op.result_snapshot->>'source_id')::uuid,
      (v_existing_op.result_snapshot->>'storage_asset_id')::uuid,
      v_existing_op.result_snapshot->>'storage_bucket',
      v_existing_op.result_snapshot->>'storage_path',
      v_existing_op.result_snapshot->>'public_url',
      true;
    return;
  end if;

  select i.* into v_existing_image from public.product_images i where i.id=p_product_image_id;
  if found then
    if v_existing_image.product_id <> p_product_id
       or v_existing_image.public_url <> p_public_url
       or v_existing_image.storage_bucket is distinct from p_bucket_id
       or v_existing_image.storage_path is distinct from p_object_path
       or v_existing_image.source_id is distinct from v_source.id
       or v_existing_image.source_type <> 'CATALOG_EVIDENCE_CROP'
       or v_existing_image.asset_role <> 'DERIVATIVE'
       or v_existing_image.derivative_profile is distinct from 'WEB_CARD'
       or v_existing_image.status <> 'ACTIVE' then
      raise exception using errcode='23505', message='LIHEN_WEB_IMAGE_METADATA_CONFLICT';
    end if;
  else
    if exists (select 1 from public.product_images i where i.product_id=p_product_id and i.status='ACTIVE') then
      raise exception using errcode='23505', message='LIHEN_WEB_IMAGE_EXISTING_ACTIVE_MEDIA_REQUIRES_REVIEW';
    end if;
    insert into public.product_images(
      id,product_id,public_url,storage_bucket,storage_path,alt_text,is_main,sort_order,
      source_type,status,source_id,asset_role,derivative_profile
    ) values (
      p_product_image_id,p_product_id,p_public_url,p_bucket_id,p_object_path,v_product_name,true,0,
      'CATALOG_EVIDENCE_CROP','ACTIVE',v_source.id,'DERIVATIVE','WEB_CARD'
    );
  end if;

  select a.* into v_existing_asset
  from lihen_private.product_image_storage_assets a
  where a.bucket_id=p_bucket_id and a.object_path=p_object_path;
  if found then
    if v_existing_asset.product_id <> p_product_id
       or v_existing_asset.product_image_id <> p_product_image_id
       or v_existing_asset.variant <> 'WEB'
       or v_existing_asset.mime_type <> p_mime_type
       or v_existing_asset.byte_size <> p_byte_size
       or v_existing_asset.sha256 <> p_sha256
       or v_existing_asset.width_px is distinct from p_width_px
       or v_existing_asset.height_px is distinct from p_height_px
       or v_existing_asset.status <> 'ACTIVE'
       or v_existing_asset.rendition_profile is distinct from 'WEB_CARD' then
      raise exception using errcode='23505', message='LIHEN_WEB_IMAGE_STORAGE_ASSET_CONFLICT';
    end if;
    v_asset_id := v_existing_asset.id;
  else
    insert into lihen_private.product_image_storage_assets(
      product_id,product_image_id,variant,bucket_id,object_path,mime_type,byte_size,sha256,
      width_px,height_px,status,activated_at,rendition_profile
    ) values (
      p_product_id,p_product_image_id,'WEB',p_bucket_id,p_object_path,p_mime_type,p_byte_size,p_sha256,
      p_width_px,p_height_px,'ACTIVE',now(),'WEB_CARD'
    ) returning id into v_asset_id;
  end if;

  insert into lihen_private.web_image_storage_cutover_operations(
    operation_key,request_fingerprint,product_id,product_image_id,source_id,bucket_id,object_path,result_snapshot
  ) values (
    btrim(p_operation_key),v_fingerprint,p_product_id,p_product_image_id,v_source.id,p_bucket_id,p_object_path,
    jsonb_build_object(
      'product_image_id',p_product_image_id,'product_id',p_product_id,'source_id',v_source.id,
      'storage_asset_id',v_asset_id,'storage_bucket',p_bucket_id,'storage_path',p_object_path,'public_url',p_public_url
    )
  );

  return query select p_product_image_id,p_product_id,v_source.id,v_asset_id,p_bucket_id,p_object_path,p_public_url,false;
end;
$function$;

revoke all on function public.finalize_web_image_storage_cutover(text,uuid,uuid,text,text,text,text,text,bigint,text,integer,integer) from public, anon, authenticated;
grant execute on function public.finalize_web_image_storage_cutover(text,uuid,uuid,text,text,text,text,text,bigint,text,integer,integer) to service_role;

comment on function public.finalize_web_image_storage_cutover(text,uuid,uuid,text,text,text,text,text,bigint,text,integer,integer) is 'Server-side idempotent metadata finalizer for Fase 1.22.2. Call only after the exact WebP object has been uploaded to lihen-product-web via Storage API. Does not enable product visibility and does not mutate products.main_image_url.';
