alter table public.catalog_versions
  add column if not exists created_by uuid null references public.profiles(id) on delete set null,
  add column if not exists activated_at timestamptz null,
  add column if not exists activated_by uuid null references public.profiles(id) on delete set null,
  add column if not exists archived_at timestamptz null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.catalog_entries
  add column if not exists product_sku_snapshot text null,
  add column if not exists catalog_code_snapshot text null,
  add column if not exists slug_snapshot text not null default '',
  add column if not exists business_line_snapshot text not null default '',
  add column if not exists brand_snapshot text null,
  add column if not exists category_snapshot text null,
  add column if not exists subcategory_snapshot text null,
  add column if not exists description_snapshot text null,
  add column if not exists image_id_snapshot uuid null,
  add column if not exists image_url_snapshot text not null default '',
  add column if not exists image_alt_snapshot text null,
  add column if not exists product_updated_at_snapshot timestamptz null;

alter table public.catalog_entries
  add constraint catalog_entries_slug_snapshot_not_blank check (btrim(slug_snapshot) <> ''),
  add constraint catalog_entries_business_line_snapshot_not_blank check (btrim(business_line_snapshot) <> ''),
  add constraint catalog_entries_image_url_snapshot_not_blank check (btrim(image_url_snapshot) <> '');

create or replace function public.guard_catalog_entry_mutation()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare v_version_id uuid; v_status text;
begin
  v_version_id := coalesce(new.catalog_version_id, old.catalog_version_id);
  select cv.status into v_status from public.catalog_versions cv where cv.id = v_version_id;
  if v_status is distinct from 'DRAFT' then raise exception using errcode='55000', message='LIHEN_CATALOG_VERSION_IMMUTABLE'; end if;
  if tg_op = 'DELETE' then return old; end if; return new;
end; $function$;
revoke all on function public.guard_catalog_entry_mutation() from public, anon, authenticated;
drop trigger if exists catalog_entries_draft_only_mutation on public.catalog_entries;
create trigger catalog_entries_draft_only_mutation before insert or update or delete on public.catalog_entries for each row execute function public.guard_catalog_entry_mutation();

create or replace function public.guard_catalog_version_mutation()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if tg_op = 'DELETE' and old.status <> 'DRAFT' then raise exception using errcode='55000', message='LIHEN_CATALOG_VERSION_IMMUTABLE'; end if;
  if tg_op = 'UPDATE' then
    if old.status = 'ACTIVE' then
      if new.status <> 'ARCHIVED' or new.code is distinct from old.code or new.title is distinct from old.title or new.version_label is distinct from old.version_label or new.source_type is distinct from old.source_type or new.effective_at is distinct from old.effective_at or new.source_reference is distinct from old.source_reference or new.created_by is distinct from old.created_by or new.activated_at is distinct from old.activated_at or new.activated_by is distinct from old.activated_by then
        raise exception using errcode='55000', message='LIHEN_CATALOG_VERSION_IMMUTABLE';
      end if;
    elsif old.status = 'ARCHIVED' then raise exception using errcode='55000', message='LIHEN_CATALOG_VERSION_IMMUTABLE'; end if;
    new.updated_at := now();
  end if;
  if tg_op = 'DELETE' then return old; end if; return new;
end; $function$;
revoke all on function public.guard_catalog_version_mutation() from public, anon, authenticated;
drop trigger if exists catalog_versions_immutability_guard on public.catalog_versions;
create trigger catalog_versions_immutability_guard before update or delete on public.catalog_versions for each row execute function public.guard_catalog_version_mutation();
comment on table public.catalog_entries is 'Versioned immutable catalog snapshots. ACTIVE/ARCHIVED versions render only from snapshot fields, never live Product Master data.';
