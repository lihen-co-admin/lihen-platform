create or replace function public.register_pdf_catalog_artifact_controlled(
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
  v_active_pdf_count bigint;
  v_entry_count bigint;
  v_validation_failures bigint;
  v_has_institutional_snapshot boolean;
  v_code text;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_CATALOG_WRITE_FORBIDDEN';
  end if;

  select cv.status,cv.artifact_sha256,cv.code into v_status,v_existing_sha,v_code
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
     set artifact_url=btrim(p_artifact_url),artifact_sha256=lower(btrim(p_artifact_sha256)),
         artifact_page_count=p_page_count,artifact_size_bytes=p_size_bytes,
         renderer_version=btrim(p_renderer_version),artifact_generated_at=now(),artifact_registered_by=v_actor
   where id=p_catalog_version_id;

  insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata)
  values(gen_random_uuid(),'CATALOG_PDF_ARTIFACT_REGISTERED','CATALOG_VERSION',p_catalog_version_id,now(),v_actor,
         jsonb_build_object('sha256',lower(btrim(p_artifact_sha256)),'page_count',p_page_count,'size_bytes',p_size_bytes,'renderer_version',btrim(p_renderer_version)),
         jsonb_build_object('phase','4'));

  select count(*) into v_active_pdf_count from public.catalog_versions where source_type='PDF' and status='ACTIVE';
  select count(*) into v_entry_count from public.catalog_entries where catalog_version_id=p_catalog_version_id and visible;
  select exists(select 1 from public.catalog_institutional_snapshots where catalog_version_id=p_catalog_version_id) into v_has_institutional_snapshot;
  select count(*) into v_validation_failures
  from public.validate_pdf_catalog_version_controlled(p_catalog_version_id) v where v.status='FAIL';

  insert into lihen_private.phase_exit_gate_results(
    phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at
  ) values (
    '4',
    case when v_active_pdf_count=1 and v_entry_count>0 and v_has_institutional_snapshot and v_validation_failures=0
                   and p_page_count>0 and p_size_bytes>0 and lower(btrim(p_artifact_sha256)) ~ '^[0-9a-f]{64}$'
         then 'PASS' else 'BLOCKED' end,
    'PHASE4_CANONICAL_PDF_PUBLICATION_EXIT_GATE_V1',
    jsonb_build_object(
      'catalog_version_id',p_catalog_version_id,
      'catalog_code',v_code,
      'active_pdf_version_count',v_active_pdf_count,
      'visible_entry_count',v_entry_count,
      'institutional_snapshot',v_has_institutional_snapshot,
      'validation_failure_count',v_validation_failures,
      'artifact_sha256',lower(btrim(p_artifact_sha256)),
      'artifact_page_count',p_page_count,
      'artifact_size_bytes',p_size_bytes,
      'renderer_version',btrim(p_renderer_version),
      'non_blocking_debt',jsonb_build_array('PHASE4_INSTITUTIONAL_PAGES_2_3_4_VISUAL_REFINEMENT')
    ),
    '[]'::jsonb,
    'Phase 4 closed when the single ACTIVE canonical PDF version has immutable product and institutional snapshots, all validation checks pass, and the reviewed physical PDF artifact is registered with SHA-256. Visual refinement of institutional pages 2-4 remains non-blocking.',
    now()
  )
  on conflict(phase_code) do update set
    status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,
    accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
end;
$function$;
revoke all on function public.register_pdf_catalog_artifact_controlled(uuid,text,text,integer,bigint,text) from public,anon;
grant execute on function public.register_pdf_catalog_artifact_controlled(uuid,text,text,integer,bigint,text) to authenticated;
