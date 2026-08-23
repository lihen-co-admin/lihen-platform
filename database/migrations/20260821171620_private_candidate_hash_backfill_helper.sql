create or replace function lihen_private.backfill_candidate_hash_lines(p_run_id uuid,p_lines text)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare v_updated integer;
begin
  with src as (
    select split_part(line,'|',1) as source_reference_id,
           split_part(line,'|',2) as image_sha256
    from string_to_table(p_lines,E'\n') line
    where length(line)>0
  )
  update lihen_private.product_import_candidates c
  set image_sha256=s.image_sha256
  from src s
  where c.run_id=p_run_id
    and c.source_reference_id=s.source_reference_id
    and c.image_sha256 is null
    and s.image_sha256 ~ '^[0-9a-f]{64}$';
  get diagnostics v_updated=row_count;
  return v_updated;
end;$$;
revoke all on function lihen_private.backfill_candidate_hash_lines(uuid,text) from public,anon,authenticated;
