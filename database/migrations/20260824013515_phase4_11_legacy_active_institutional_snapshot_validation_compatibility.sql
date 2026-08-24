create or replace function public.validate_pdf_catalog_version_controlled(p_catalog_version_id uuid)
returns table(check_name text, status text, issue_count bigint)
language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')
  ) then raise exception using errcode='42501', message='LIHEN_CATALOG_READ_FORBIDDEN'; end if;
  if not exists(select 1 from public.catalog_versions cv where cv.id=p_catalog_version_id) then
    raise exception using errcode='P0002', message='LIHEN_CATALOG_VERSION_NOT_FOUND';
  end if;

  return query
  select 'HAS_VISIBLE_ENTRIES',case when count(*)>0 then 'PASS' else 'FAIL' end,count(*) filter(where false)
  from public.catalog_entries e where e.catalog_version_id=p_catalog_version_id and e.visible
  union all
  select 'PRICE_VALIDITY',case when count(*)=0 then 'PASS' else 'FAIL' end,count(*)
  from public.catalog_entries e where e.catalog_version_id=p_catalog_version_id and e.visible and e.sale_price_snapshot<0
  union all
  select 'IMAGE_COMPLETENESS',case when count(*)=0 then 'PASS' else 'FAIL' end,count(*)
  from public.catalog_entries e where e.catalog_version_id=p_catalog_version_id and e.visible and btrim(e.image_url_snapshot)=''
  union all
  select 'NAME_COMPLETENESS',case when count(*)=0 then 'PASS' else 'FAIL' end,count(*)
  from public.catalog_entries e where e.catalog_version_id=p_catalog_version_id and e.visible and btrim(e.product_name_snapshot)=''
  union all
  select 'SORT_ORDER_UNIQUENESS',case when count(*)=0 then 'PASS' else 'FAIL' end,count(*)
  from (
    select e.sort_order from public.catalog_entries e
    where e.catalog_version_id=p_catalog_version_id and e.visible
    group by e.sort_order having count(*)>1
  ) d
  union all
  select 'INSTITUTIONAL_SNAPSHOT',
         case when cv.status <> 'DRAFT' or s.catalog_version_id is not null then 'PASS' else 'FAIL' end,
         case when cv.status <> 'DRAFT' or s.catalog_version_id is not null then 0 else 1 end
  from public.catalog_versions cv
  left join public.catalog_institutional_snapshots s on s.catalog_version_id=cv.id
  where cv.id=p_catalog_version_id;
end;
$function$;
