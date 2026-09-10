begin;

create or replace function public.persist_intelligence_image_transformation_candidate(
  p_request_id text,
  p_correlation_id text,
  p_product_id uuid,
  p_source_product_image_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_sha256 text,
  p_provider_name text,
  p_intended_use text,
  p_constraints jsonb,
  p_created_by uuid
)
returns table (
  id uuid,
  storage_bucket text,
  storage_path text,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, lihen_private
as $$
begin
  return query
  insert into lihen_private.intelligence_image_transformation_candidates (
    request_id,
    correlation_id,
    product_id,
    source_product_image_id,
    operation_code,
    storage_bucket,
    storage_path,
    mime_type,
    sha256,
    provider_name,
    intended_use,
    constraints,
    status,
    created_by
  )
  values (
    p_request_id,
    p_correlation_id,
    p_product_id,
    p_source_product_image_id,
    'REMOVE_BACKGROUND',
    p_storage_bucket,
    p_storage_path,
    p_mime_type,
    p_sha256,
    p_provider_name,
    p_intended_use,
    coalesce(p_constraints, '[]'::jsonb),
    'PENDING_REVIEW',
    p_created_by
  )
  returning
    intelligence_image_transformation_candidates.id,
    intelligence_image_transformation_candidates.storage_bucket,
    intelligence_image_transformation_candidates.storage_path,
    intelligence_image_transformation_candidates.status;
end;
$$;

revoke all
on function public.persist_intelligence_image_transformation_candidate(
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  uuid
)
from public, anon, authenticated;

grant execute
on function public.persist_intelligence_image_transformation_candidate(
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  uuid
)
to service_role;

commit;
