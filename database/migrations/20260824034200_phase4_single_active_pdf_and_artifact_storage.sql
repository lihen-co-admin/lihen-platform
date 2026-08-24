-- Keep the newest ACTIVE PDF version and archive any older ACTIVE PDF versions.
with ranked as (
  select id,
         row_number() over (order by activated_at desc nulls last, effective_at desc nulls last, created_at desc, id desc) as rn
  from public.catalog_versions
  where source_type='PDF' and status='ACTIVE'
), archived as (
  update public.catalog_versions cv
     set status='ARCHIVED', archived_at=coalesce(cv.archived_at,now())
    from ranked r
   where cv.id=r.id and r.rn>1
  returning cv.id
)
insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata)
select gen_random_uuid(),'CATALOG_VERSION_SUPERSEDED','CATALOG_VERSION',a.id,now(),null,
       jsonb_build_object('status','ARCHIVED','reason','SINGLE_ACTIVE_PDF_INVARIANT'),
       jsonb_build_object('phase','4','source','migration')
from archived a;

create unique index if not exists catalog_versions_single_active_pdf_uq
  on public.catalog_versions ((1))
  where source_type='PDF' and status='ACTIVE';

create or replace function public.activate_pdf_catalog_version_controlled(p_catalog_version_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_status text;
  v_source_type text;
  v_failures bigint;
begin
  if v_actor is null then
    raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED';
  end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501',message='LIHEN_CATALOG_WRITE_FORBIDDEN';
  end if;

  select cv.status,cv.source_type into v_status,v_source_type
  from public.catalog_versions cv
  where cv.id=p_catalog_version_id
  for update;

  if v_status is null then
    raise exception using errcode='P0002',message='LIHEN_CATALOG_VERSION_NOT_FOUND';
  end if;
  if v_status<>'DRAFT' then
    raise exception using errcode='55000',message='LIHEN_CATALOG_VERSION_NOT_DRAFT';
  end if;

  select count(*) into v_failures
  from public.validate_pdf_catalog_version_controlled(p_catalog_version_id) v
  where v.status='FAIL';
  if v_failures>0 then
    raise exception using errcode='23514',message='LIHEN_CATALOG_VALIDATION_FAILED',detail=v_failures::text;
  end if;

  if v_source_type='PDF' then
    with archived as (
      update public.catalog_versions
         set status='ARCHIVED',archived_at=coalesce(archived_at,now())
       where source_type='PDF' and status='ACTIVE' and id<>p_catalog_version_id
      returning id
    )
    insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata)
    select gen_random_uuid(),'CATALOG_VERSION_SUPERSEDED','CATALOG_VERSION',a.id,now(),v_actor,
           jsonb_build_object('status','ARCHIVED','superseded_by',p_catalog_version_id),
           jsonb_build_object('phase','4')
    from archived a;
  end if;

  update public.catalog_versions
     set status='ACTIVE',effective_at=coalesce(effective_at,now()),activated_at=now(),activated_by=v_actor
   where id=p_catalog_version_id;

  insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata)
  values(gen_random_uuid(),'CATALOG_VERSION_ACTIVATED','CATALOG_VERSION',p_catalog_version_id,now(),v_actor,
         jsonb_build_object('status','ACTIVE'),jsonb_build_object('phase','4'));
end;
$function$;
revoke all on function public.activate_pdf_catalog_version_controlled(uuid) from public,anon;
grant execute on function public.activate_pdf_catalog_version_controlled(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('catalog-pdf-artifacts','catalog-pdf-artifacts',true,104857600,array['application/pdf']::text[])
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Uploads are allowed only to active OWNER/ADMIN users. Published files are public because the bucket is public.
drop policy if exists catalog_pdf_artifacts_owner_admin_insert on storage.objects;
create policy catalog_pdf_artifacts_owner_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='catalog-pdf-artifacts'
  and exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')
  )
);

alter table public.catalog_versions
  add column if not exists artifact_size_bytes bigint null;

alter table public.catalog_versions
  drop constraint if exists catalog_versions_artifact_size_bytes_positive;
alter table public.catalog_versions
  add constraint catalog_versions_artifact_size_bytes_positive
  check(artifact_size_bytes is null or artifact_size_bytes>0);

drop function if exists public.register_pdf_catalog_artifact_controlled(uuid,text,text,integer,text);
create function public.register_pdf_catalog_artifact_controlled(
  p_catalog_version_id uuid,
  p_artifact_url text,
  p_artifact_sha256 text,
  p_page_count integer,
  p_size_bytes bigint,
  p_renderer_version text
) returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_status text;
  v_existing_sha text;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_CATALOG_WRITE_FORBIDDEN';
  end if;
  select cv.status,cv.artifact_sha256 into v_status,v_existing_sha
  from public.catalog_versions cv where cv.id=p_catalog_version_id for update;
  if v_status is null then raise exception using errcode='P0002',message='LIHEN_CATALOG_VERSION_NOT_FOUND'; end if;
  if v_status<>'ACTIVE' then raise exception using errcode='55000',message='LIHEN_CATALOG_ARTIFACT_REQUIRES_ACTIVE_VERSION'; end if;
  if v_existing_sha is not null then raise exception using errcode='55000',message='LIHEN_CATALOG_ARTIFACT_ALREADY_REGISTERED'; end if;
  if nullif(btrim(p_artifact_url),'') is null then raise exception using errcode='22023',message='LIHEN_CATALOG_ARTIFACT_URL_REQUIRED'; end if;
  if lower(btrim(p_artifact_sha256)) !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023',message='LIHEN_CATALOG_ARTIFACT_SHA256_INVALID'; end if;
  if p_page_count is null or p_page_count<=0 then raise exception using errcode='22023',message='LIHEN_CATALOG_ARTIFACT_PAGE_COUNT_INVALID'; end if;
  if p_size_bytes is null or p_size_bytes<=0 then raise exception using errcode='22023',message='LIHEN_CATALOG_ARTIFACT_SIZE_INVALID'; end if;
  if nullif(btrim(p_renderer_version),'') is null then raise exception using errcode='22023',message='LIHEN_CATALOG_RENDERER_VERSION_REQUIRED'; end if;

  update public.catalog_versions
     set artifact_url=btrim(p_artifact_url),
         artifact_sha256=lower(btrim(p_artifact_sha256)),
         artifact_page_count=p_page_count,
         artifact_size_bytes=p_size_bytes,
         renderer_version=btrim(p_renderer_version),
         artifact_generated_at=now(),
         artifact_registered_by=v_actor
   where id=p_catalog_version_id;

  insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata)
  values(gen_random_uuid(),'CATALOG_PDF_ARTIFACT_REGISTERED','CATALOG_VERSION',p_catalog_version_id,now(),v_actor,
         jsonb_build_object('sha256',lower(btrim(p_artifact_sha256)),'page_count',p_page_count,'size_bytes',p_size_bytes,'renderer_version',btrim(p_renderer_version)),
         jsonb_build_object('phase','4'));
end;
$function$;
revoke all on function public.register_pdf_catalog_artifact_controlled(uuid,text,text,integer,bigint,text) from public,anon;
grant execute on function public.register_pdf_catalog_artifact_controlled(uuid,text,text,integer,bigint,text) to authenticated;

create or replace view public.catalog_pdf_publication_status with(security_invoker=true) as
select cv.id catalog_version_id,cv.code,cv.version_label,cv.status,cv.activated_at,
       cv.artifact_url,cv.artifact_sha256,cv.artifact_page_count,
       cv.renderer_version,cv.artifact_generated_at,
       case
         when cv.status='DRAFT' then 'DRAFT'
         when cv.status='ACTIVE' and cv.artifact_sha256 is null then 'READY_TO_RENDER'
         when cv.status='ACTIVE' and cv.artifact_sha256 is not null then 'PUBLISHED'
         when cv.status='ARCHIVED' then 'ARCHIVED'
         else 'UNKNOWN'
       end publication_status,
       cv.artifact_size_bytes
from public.catalog_versions cv;
revoke all on public.catalog_pdf_publication_status from public,anon;
grant select on public.catalog_pdf_publication_status to authenticated;
