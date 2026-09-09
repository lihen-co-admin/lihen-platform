begin;

drop function if exists
  public.get_approved_intelligence_transformation_candidate_for_catalog_(uuid);

create or replace function public.get_catalog_pdf_approved_candidate(
  p_candidate_id uuid
)
returns table (
  candidate_id uuid,
  product_id uuid,
  source_product_image_id uuid,
  source_id uuid,
  review_bucket text,
  review_path text,
  review_mime_type text,
  intended_use text,
  provider_name text,
  source_derivative_profile text,
  source_image_status text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate lihen_private.intelligence_image_transformation_candidates%rowtype;
  v_source_image public.product_images%rowtype;
  v_source lihen_private.product_image_sources%rowtype;
begin
  if p_candidate_id is null then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_CATALOG_PDF_CANDIDATE_ID_REQUIRED';
  end if;

  select c.*
  into v_candidate
  from lihen_private.intelligence_image_transformation_candidates c
  where c.id = p_candidate_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'LIHEN_CATALOG_PDF_CANDIDATE_NOT_FOUND';
  end if;

  if v_candidate.status <> 'APPROVED' then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_CATALOG_PDF_CANDIDATE_NOT_APPROVED';
  end if;

  if v_candidate.reviewed_by is null
     or v_candidate.reviewed_at is null then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_CATALOG_PDF_CANDIDATE_REVIEW_EVIDENCE_REQUIRED';
  end if;

  if v_candidate.operation_code <> 'REMOVE_BACKGROUND' then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_CATALOG_PDF_CANDIDATE_OPERATION_INVALID';
  end if;

  if v_candidate.intended_use <> 'CATALOG_PDF' then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_CATALOG_PDF_CANDIDATE_INTENDED_USE_INVALID';
  end if;

  if v_candidate.storage_bucket <> 'lihen-intelligence-review'
     or v_candidate.mime_type <> 'image/png' then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_CATALOG_PDF_CANDIDATE_STORAGE_CONTRACT_INVALID';
  end if;

  select pi.*
  into v_source_image
  from public.product_images pi
  where pi.id = v_candidate.source_product_image_id
    and pi.product_id = v_candidate.product_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'LIHEN_CATALOG_PDF_SOURCE_PRODUCT_IMAGE_NOT_FOUND';
  end if;

  if v_source_image.status <> 'ACTIVE' then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_CATALOG_PDF_SOURCE_PRODUCT_IMAGE_NOT_ACTIVE';
  end if;

  if v_source_image.source_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'LIHEN_CATALOG_PDF_SOURCE_PROVENANCE_REQUIRED';
  end if;

  select s.*
  into v_source
  from lihen_private.product_image_sources s
  where s.id = v_source_image.source_id
    and s.product_id = v_candidate.product_id
    and s.is_exact_product_match = true
    and s.requires_review = false
    and s.review_status in ('EVIDENCE_ACCEPTED', 'HUMAN_APPROVED')
    and s.publication_eligibility in ('FALLBACK_ONLY', 'ELIGIBLE_PRIMARY');

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'LIHEN_CATALOG_PDF_SOURCE_PROVENANCE_NOT_ELIGIBLE';
  end if;

  return query
  select
    v_candidate.id,
    v_candidate.product_id,
    v_candidate.source_product_image_id,
    v_source.id,
    v_candidate.storage_bucket,
    v_candidate.storage_path,
    v_candidate.mime_type,
    v_candidate.intended_use,
    v_candidate.provider_name,
    v_source_image.derivative_profile,
    v_source_image.status;
end;
$function$;

revoke all
on function public.get_catalog_pdf_approved_candidate(uuid)
from public, anon, authenticated;

grant execute
on function public.get_catalog_pdf_approved_candidate(uuid)
to service_role;

comment on function public.get_catalog_pdf_approved_candidate(uuid)
is 'Service-role-only read gate for an APPROVED REMOVE_BACKGROUND candidate intended for CATALOG_PDF. Validates review evidence, private review storage contract, active source image, and eligible canonical provenance. Performs no mutation or publication.';

commit;
