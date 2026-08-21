alter table lihen_private.web_image_derivative_runs
  add column if not exists metadata_authority text,
  add column if not exists upload_manifest_sha256 text,
  add column if not exists derivative_manifest_sha256 text,
  add column if not exists generated_total_bytes bigint;
drop function if exists lihen_private.ingest_web_derivative_lines(uuid,text);
