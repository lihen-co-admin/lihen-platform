-- F5-S1A/B corrective migration.
-- Fixes PostgreSQL regex word-boundary escaping and contiguous proposal numbering.
-- READ ONLY: replaces only the dry-run function; no product/category/brand/image/visibility rows are mutated.

create or replace function public.get_style_identity_taxonomy_dry_run_controlled()
returns table (
  product_id uuid,
  current_sku text,
  current_catalog_code text,
  product_name text,
  identity_action text,
  proposed_sku text,
  proposed_catalog_code text,
  proposed_category_key text,
  proposed_category_label text,
  category_requires_approval boolean,
  brand_requires_approval boolean,
  notes text[]
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles pr
    where pr.id = v_actor
      and pr.authorization_status = 'ACTIVE'
      and pr.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')
  ) then
    raise exception using errcode='42501', message='LIHEN_STYLE_READ_FORBIDDEN';
  end if;

  return query
  with style_base as (
    select
      p.id,
      p.sku,
      p.catalog_code,
      p.name,
      case
        when nullif(btrim(p.sku),'') is not null
          and upper(btrim(p.sku)) ~ '^ST-[0-9]+$'
        then true
        else false
      end as has_style_sku,
      case
        when lower(p.name) ~ '\m(anillo|arete|aretes|ear cuff)\M' then 'ACCESORIOS'
        when lower(p.name) ~ '\m(blusa|body)\M' then 'BLUSAS_Y_BODIES'
        when lower(p.name) ~ '\mcamiseta\M' then 'CAMISETAS'
        when lower(p.name) ~ '\m(medias|media)\M' then 'MEDIAS'
        when lower(p.name) ~ '\m(pantaloneta|short)\M'
          and lower(p.name) ~ '\mhombre\M'
        then 'ROPA_DEPORTIVA_HOMBRE'
        when lower(p.name) ~ '\m(conjunto|falda|short|top)\M'
          or lower(p.name) like '%push up%'
        then 'ROPA_DEPORTIVA_MUJER'
        else 'REVIEW_REQUIRED'
      end as category_key
    from public.products p
    where p.business_line = 'STYLE'
  ),
  max_style_number as (
    select coalesce(
      max((regexp_match(upper(btrim(p.sku)), '^ST-([0-9]+)$'))[1]::integer),
      0
    ) as n
    from public.products p
    where nullif(btrim(p.sku),'') is not null
      and upper(btrim(p.sku)) ~ '^ST-[0-9]+$'
  ),
  new_identity_sequence as (
    select
      s.id,
      row_number() over (
        order by
          case when nullif(btrim(s.sku),'') is null then 1 else 0 end,
          coalesce(s.sku,''),
          s.name,
          s.id
      ) as proposal_seq
    from style_base s
    where not s.has_style_sku
  ),
  proposals as (
    select s.*, n.proposal_seq
    from style_base s
    left join new_identity_sequence n on n.id = s.id
  )
  select
    p.id,
    p.sku,
    p.catalog_code,
    p.name,
    case
      when not p.has_style_sku then 'PROPOSE_NEW_STYLE_SKU'
      when nullif(btrim(p.catalog_code),'') is null then 'COMPLETE_CATALOG_CODE'
      else 'KEEP_STYLE_SKU'
    end,
    case
      when not p.has_style_sku then 'ST-' || lpad((m.n + p.proposal_seq)::text, 3, '0')
      else upper(btrim(p.sku))
    end,
    case
      when not p.has_style_sku then 'ST-' || lpad((m.n + p.proposal_seq)::text, 3, '0')
      when nullif(btrim(p.catalog_code),'') is null then upper(btrim(p.sku))
      else p.catalog_code
    end,
    p.category_key,
    case p.category_key
      when 'ACCESORIOS' then 'Accesorios'
      when 'BLUSAS_Y_BODIES' then 'Blusas y bodies'
      when 'CAMISETAS' then 'Camisetas'
      when 'ROPA_DEPORTIVA_MUJER' then 'Ropa deportiva mujer'
      when 'ROPA_DEPORTIVA_HOMBRE' then 'Ropa deportiva hombre'
      when 'MEDIAS' then 'Medias'
      else null
    end,
    true,
    true,
    array_remove(array[
      case when not p.has_style_sku then 'IDENTITY_PROPOSAL_ONLY_NO_WRITE' end,
      case
        when p.category_key = 'REVIEW_REQUIRED' then 'CATEGORY_REQUIRES_MANUAL_CLASSIFICATION'
        else 'CATEGORY_LABEL_PROPOSAL_ONLY'
      end,
      'BRAND_REQUIRES_PRODUCT_LEVEL_APPROVAL',
      'VISIBLE_ON_WEBSITE_MUST_REMAIN_FALSE_DURING_S1'
    ], null)::text[]
  from proposals p
  cross join max_style_number m
  order by proposed_sku, p.name, p.id;
end;
$function$;

revoke all on function public.get_style_identity_taxonomy_dry_run_controlled() from public, anon;
grant execute on function public.get_style_identity_taxonomy_dry_run_controlled() to authenticated;

comment on function public.get_style_identity_taxonomy_dry_run_controlled() is
  'F5-S1A/B read-only proposal matrix for Style identity and taxonomy. Corrected regex classification and contiguous candidate Style SKU allocation. No proposal is canonical and no product/category/brand is mutated.';
