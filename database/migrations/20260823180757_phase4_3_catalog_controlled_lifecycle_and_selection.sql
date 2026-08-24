create or replace function public.get_pdf_catalog_candidates_controlled()
returns table(product_id uuid, sku text, catalog_code text, product_name text, business_line text, brand text, category text, subcategory text, sale_price numeric, product_status text, image_id uuid, image_url text, image_alt text, eligible boolean, blocking_reasons text[])
language plpgsql security definer set search_path = '' as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')) then raise exception using errcode='42501', message='LIHEN_CATALOG_READ_FORBIDDEN'; end if;
  return query select p.id,p.sku,p.catalog_code,p.name,p.business_line,coalesce(b.name,p.brand),coalesce(c.name,p.category),p.subcategory,p.sale_price,p.status,i.id,i.public_url,i.alt_text,
    (p.status='ACTIVE' and p.sale_price >= 0 and i.id is not null),
    array_remove(array[case when p.status <> 'ACTIVE' then 'PRODUCT_NOT_ACTIVE' end,case when p.sale_price < 0 then 'INVALID_SALE_PRICE' end,case when i.id is null then 'MISSING_CANONICAL_IMAGE' end],null)::text[]
  from public.products p left join public.brands b on b.id=p.brand_id left join public.categories c on c.id=p.category_id
  left join lateral (select pi.id,pi.public_url,pi.alt_text from public.product_images pi where pi.product_id=p.id and pi.status='ACTIVE' and btrim(pi.public_url)<>'' order by pi.is_main desc,pi.sort_order asc,pi.created_at asc,pi.id asc limit 1) i on true
  order by p.business_line,coalesce(c.name,p.category,''),coalesce(b.name,p.brand,''),p.name,p.id;
end; $function$;
revoke all on function public.get_pdf_catalog_candidates_controlled() from public, anon; grant execute on function public.get_pdf_catalog_candidates_controlled() to authenticated;

create or replace function public.create_pdf_catalog_version_controlled(p_code text,p_title text,p_version_label text,p_source_reference text default null)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_CATALOG_WRITE_FORBIDDEN'; end if;
 if nullif(btrim(p_code),'') is null or nullif(btrim(p_title),'') is null or nullif(btrim(p_version_label),'') is null then raise exception using errcode='22023',message='LIHEN_CATALOG_REQUIRED_FIELDS'; end if;
 insert into public.catalog_versions(code,title,version_label,source_type,status,source_reference,created_by) values(btrim(p_code),btrim(p_title),btrim(p_version_label),'PDF','DRAFT',nullif(btrim(p_source_reference),''),v_actor) returning id into v_id;
 insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata) values(gen_random_uuid(),'CATALOG_VERSION_CREATED','CATALOG_VERSION',v_id,now(),v_actor,jsonb_build_object('code',btrim(p_code),'source_type','PDF','status','DRAFT'),jsonb_build_object('phase','4'));
 return v_id;
end; $function$;
revoke all on function public.create_pdf_catalog_version_controlled(text,text,text,text) from public,anon; grant execute on function public.create_pdf_catalog_version_controlled(text,text,text,text) to authenticated;

create or replace function public.replace_pdf_catalog_selection_controlled(p_catalog_version_id uuid,p_product_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $function$
declare v_actor uuid:=auth.uid(); v_status text; v_expected integer:=coalesce(cardinality(p_product_ids),0); v_distinct integer; v_invalid integer; v_inserted integer;
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_CATALOG_WRITE_FORBIDDEN'; end if;
 select cv.status into v_status from public.catalog_versions cv where cv.id=p_catalog_version_id for update;
 if v_status is null then raise exception using errcode='P0002',message='LIHEN_CATALOG_VERSION_NOT_FOUND'; end if; if v_status<>'DRAFT' then raise exception using errcode='55000',message='LIHEN_CATALOG_VERSION_IMMUTABLE'; end if; if v_expected=0 then raise exception using errcode='22023',message='LIHEN_CATALOG_SELECTION_EMPTY'; end if;
 select count(distinct x) into v_distinct from unnest(p_product_ids) x; if v_distinct<>v_expected then raise exception using errcode='22023',message='LIHEN_CATALOG_DUPLICATE_PRODUCT_SELECTION'; end if;
 with selected as(select x as product_id from unnest(p_product_ids) x), resolved as(select s.product_id,p.status,p.sale_price,i.id image_id from selected s left join public.products p on p.id=s.product_id left join lateral(select pi.id from public.product_images pi where pi.product_id=p.id and pi.status='ACTIVE' and btrim(pi.public_url)<>'' order by pi.is_main desc,pi.sort_order asc,pi.created_at asc,pi.id asc limit 1)i on true) select count(*) into v_invalid from resolved where status is null or status<>'ACTIVE' or sale_price<0 or image_id is null;
 if v_invalid>0 then raise exception using errcode='23514',message='LIHEN_CATALOG_SELECTION_HAS_INELIGIBLE_PRODUCTS',detail=v_invalid::text; end if;
 delete from public.catalog_entries where catalog_version_id=p_catalog_version_id;
 insert into public.catalog_entries(catalog_version_id,product_id,product_name_snapshot,sale_price_snapshot,visible,sort_order,product_sku_snapshot,catalog_code_snapshot,slug_snapshot,business_line_snapshot,brand_snapshot,category_snapshot,subcategory_snapshot,description_snapshot,image_id_snapshot,image_url_snapshot,image_alt_snapshot,product_updated_at_snapshot)
 select p_catalog_version_id,p.id,p.name,p.sale_price,true,(u.ordinality-1)::integer,p.sku,p.catalog_code,p.slug,p.business_line,coalesce(b.name,p.brand),coalesce(c.name,p.category),p.subcategory,p.description,i.id,i.public_url,i.alt_text,p.updated_at from unnest(p_product_ids) with ordinality u(product_id,ordinality) join public.products p on p.id=u.product_id left join public.brands b on b.id=p.brand_id left join public.categories c on c.id=p.category_id join lateral(select pi.id,pi.public_url,pi.alt_text from public.product_images pi where pi.product_id=p.id and pi.status='ACTIVE' and btrim(pi.public_url)<>'' order by pi.is_main desc,pi.sort_order asc,pi.created_at asc,pi.id asc limit 1)i on true;
 get diagnostics v_inserted=row_count;
 insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata) values(gen_random_uuid(),'CATALOG_SELECTION_REPLACED','CATALOG_VERSION',p_catalog_version_id,now(),v_actor,jsonb_build_object('entry_count',v_inserted),jsonb_build_object('phase','4'));
 return v_inserted;
end; $function$;
revoke all on function public.replace_pdf_catalog_selection_controlled(uuid,uuid[]) from public,anon; grant execute on function public.replace_pdf_catalog_selection_controlled(uuid,uuid[]) to authenticated;

create or replace function public.validate_pdf_catalog_version_controlled(p_catalog_version_id uuid)
returns table(check_name text,status text,issue_count bigint) language plpgsql security definer set search_path='' as $function$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')) then raise exception using errcode='42501',message='LIHEN_CATALOG_READ_FORBIDDEN'; end if;
 if not exists(select 1 from public.catalog_versions cv where cv.id=p_catalog_version_id) then raise exception using errcode='P0002',message='LIHEN_CATALOG_VERSION_NOT_FOUND'; end if;
 return query select 'HAS_VISIBLE_ENTRIES',case when count(*)>0 then 'PASS' else 'FAIL' end,count(*) filter(where false) from public.catalog_entries e where e.catalog_version_id=p_catalog_version_id and e.visible
 union all select 'PRICE_VALIDITY',case when count(*)=0 then 'PASS' else 'FAIL' end,count(*) from public.catalog_entries e where e.catalog_version_id=p_catalog_version_id and e.visible and e.sale_price_snapshot<0
 union all select 'IMAGE_COMPLETENESS',case when count(*)=0 then 'PASS' else 'FAIL' end,count(*) from public.catalog_entries e where e.catalog_version_id=p_catalog_version_id and e.visible and btrim(e.image_url_snapshot)=''
 union all select 'NAME_COMPLETENESS',case when count(*)=0 then 'PASS' else 'FAIL' end,count(*) from public.catalog_entries e where e.catalog_version_id=p_catalog_version_id and e.visible and btrim(e.product_name_snapshot)=''
 union all select 'SORT_ORDER_UNIQUENESS',case when count(*)=0 then 'PASS' else 'FAIL' end,count(*) from(select e.sort_order from public.catalog_entries e where e.catalog_version_id=p_catalog_version_id and e.visible group by e.sort_order having count(*)>1)d;
end; $function$;
revoke all on function public.validate_pdf_catalog_version_controlled(uuid) from public,anon; grant execute on function public.validate_pdf_catalog_version_controlled(uuid) to authenticated;

create or replace function public.activate_pdf_catalog_version_controlled(p_catalog_version_id uuid)
returns void language plpgsql security definer set search_path='' as $function$
declare v_actor uuid:=auth.uid(); v_status text; v_failures bigint;
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if; if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_CATALOG_WRITE_FORBIDDEN'; end if;
 select cv.status into v_status from public.catalog_versions cv where cv.id=p_catalog_version_id for update; if v_status is null then raise exception using errcode='P0002',message='LIHEN_CATALOG_VERSION_NOT_FOUND'; end if; if v_status<>'DRAFT' then raise exception using errcode='55000',message='LIHEN_CATALOG_VERSION_NOT_DRAFT'; end if;
 select count(*) into v_failures from public.validate_pdf_catalog_version_controlled(p_catalog_version_id)v where v.status='FAIL'; if v_failures>0 then raise exception using errcode='23514',message='LIHEN_CATALOG_VALIDATION_FAILED',detail=v_failures::text; end if;
 update public.catalog_versions set status='ACTIVE',effective_at=coalesce(effective_at,now()),activated_at=now(),activated_by=v_actor where id=p_catalog_version_id;
 insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata) values(gen_random_uuid(),'CATALOG_VERSION_ACTIVATED','CATALOG_VERSION',p_catalog_version_id,now(),v_actor,jsonb_build_object('status','ACTIVE'),jsonb_build_object('phase','4'));
end; $function$;
revoke all on function public.activate_pdf_catalog_version_controlled(uuid) from public,anon; grant execute on function public.activate_pdf_catalog_version_controlled(uuid) to authenticated;

create or replace function public.archive_pdf_catalog_version_controlled(p_catalog_version_id uuid)
returns void language plpgsql security definer set search_path='' as $function$
declare v_actor uuid:=auth.uid(); v_status text;
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if; if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_CATALOG_WRITE_FORBIDDEN'; end if;
 select cv.status into v_status from public.catalog_versions cv where cv.id=p_catalog_version_id for update; if v_status is null then raise exception using errcode='P0002',message='LIHEN_CATALOG_VERSION_NOT_FOUND'; end if; if v_status<>'ACTIVE' then raise exception using errcode='55000',message='LIHEN_CATALOG_VERSION_NOT_ACTIVE'; end if;
 update public.catalog_versions set status='ARCHIVED',archived_at=now() where id=p_catalog_version_id;
 insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata) values(gen_random_uuid(),'CATALOG_VERSION_ARCHIVED','CATALOG_VERSION',p_catalog_version_id,now(),v_actor,jsonb_build_object('status','ARCHIVED'),jsonb_build_object('phase','4'));
end; $function$;
revoke all on function public.archive_pdf_catalog_version_controlled(uuid) from public,anon; grant execute on function public.archive_pdf_catalog_version_controlled(uuid) to authenticated;
