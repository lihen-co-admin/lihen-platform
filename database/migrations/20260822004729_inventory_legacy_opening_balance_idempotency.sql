create unique index if not exists inventory_movements_legacy_source_bucket_uniq
on public.inventory_movements(source_run_id, source_row_key, bucket)
where source_run_id is not null and source_row_key is not null;
