create table if not exists public.catalog_institutional_content (
  id text primary key default 'default',
  about_title text not null default '¿Quiénes SOMOS?',
  about_body text not null default '',
  about_image_url text,
  purchase_title text not null default 'INFORMACIÓN IMPORTANTE DE COMPRA',
  purchase_intro text not null default '',
  purchase_sections jsonb not null default '[]'::jsonb,
  legal_name text not null default 'LIHEN.CO S.A.S.',
  tax_id text,
  location_text text,
  payment_title text not null default 'MEDIOS DE PAGO',
  payment_methods jsonb not null default '[]'::jsonb,
  connect_title text not null default 'CONECTA CON LIHEN',
  connect_message text not null default '',
  channels jsonb not null default '{}'::jsonb,
  footer_label text not null default 'BEAUTY CURE | STYLE',
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint catalog_institutional_content_singleton check (id = 'default'),
  constraint catalog_institutional_purchase_sections_array check (jsonb_typeof(purchase_sections) = 'array'),
  constraint catalog_institutional_payment_methods_array check (jsonb_typeof(payment_methods) = 'array'),
  constraint catalog_institutional_channels_object check (jsonb_typeof(channels) = 'object')
);

create table if not exists public.catalog_institutional_snapshots (
  catalog_version_id uuid primary key references public.catalog_versions(id) on delete cascade,
  about_title text not null,
  about_body text not null,
  about_image_url text,
  purchase_title text not null,
  purchase_intro text not null,
  purchase_sections jsonb not null,
  legal_name text not null,
  tax_id text,
  location_text text,
  payment_title text not null,
  payment_methods jsonb not null,
  connect_title text not null,
  connect_message text not null,
  channels jsonb not null,
  footer_label text not null,
  captured_at timestamptz not null default now(),
  captured_by uuid,
  constraint catalog_institutional_snapshot_purchase_sections_array check (jsonb_typeof(purchase_sections) = 'array'),
  constraint catalog_institutional_snapshot_payment_methods_array check (jsonb_typeof(payment_methods) = 'array'),
  constraint catalog_institutional_snapshot_channels_object check (jsonb_typeof(channels) = 'object')
);

alter table public.catalog_institutional_content enable row level security;
alter table public.catalog_institutional_snapshots enable row level security;
revoke all on public.catalog_institutional_content from public, anon, authenticated;
revoke all on public.catalog_institutional_snapshots from public, anon, authenticated;

insert into public.catalog_institutional_content (
  id, about_title, about_body, purchase_title, purchase_intro, purchase_sections,
  legal_name, tax_id, location_text, payment_title, payment_methods,
  connect_title, connect_message, channels, footer_label
)
values (
  'default',
  '¿Quiénes SOMOS?',
  'LIHEN.CO S.A.S. una marca creada por dos emprendedoras caleñas que compartían una misma visión: construir una tienda en línea donde la belleza, el cuidado personal y el estilo tuvieran un lugar para todos.',
  'INFORMACIÓN IMPORTANTE DE COMPRA',
  'Queremos que tu experiencia con LIHEN.CO sea clara, segura y sencilla. 💗',
  jsonb_build_array(
    jsonb_build_object('key','prices','label','Precios','body','Los valores publicados corresponden al precio de venta al público e incluyen los impuestos aplicables.'),
    jsonb_build_object('key','availability','label','Disponibilidad','body','Nuestros productos están sujetos a disponibilidad de inventario. Te recomendamos confirmar la referencia, talla, tono, aroma o presentación antes de realizar el pago.'),
    jsonb_build_object('key','confirmation','label','Confirmación del pedido','body','Tu compra queda confirmada una vez LIHEN.CO valide el pago y confirme tu pedido.'),
    jsonb_build_object('key','images','label','Imágenes de referencia','body','Los tonos, colores y acabados pueden presentar pequeñas variaciones debido a la iluminación de las fotografías o a la configuración de la pantalla.'),
    jsonb_build_object('key','returns','label','Cambios y devoluciones','body','Aplican según las condiciones establecidas por LIHEN.CO y la normativa colombiana vigente. Algunos cosméticos, productos de higiene o cuidado personal abiertos o utilizados pueden tener restricciones por razones sanitarias.'),
    jsonb_build_object('key','shipping','label','Envíos','body','El valor, cobertura y condiciones de envío se confirman antes de finalizar tu compra.'),
    jsonb_build_object('key','informed','label','Compra informada','body','Antes de realizar tu pedido puedes consultar nuestros Términos y Condiciones, Política de Privacidad, Cambios y Devoluciones y Política de Envíos.')
  ),
  'LIHEN.CO S.A.S.',
  'NIT 902.074.662-5',
  'Cali, Valle del Cauca · Colombia',
  'MEDIOS DE PAGO',
  '[]'::jsonb,
  'CONECTA CON LIHEN',
  'Gracias por confiar en LIHEN. Queremos seguir acompañándote con belleza, cuidado y estilo. Síguenos y únete a nuestra comunidad para descubrir nuevos productos, novedades y actualizaciones. Visita nuestra tienda virtual o escríbenos por WhatsApp para consultar y comprar de forma directa.',
  jsonb_build_object(
    'storefront_url', null,
    'whatsapp_url', 'https://wa.me/message/2JDWBH57SQG4F1',
    'instagram_url', null,
    'tiktok_url', null,
    'facebook_url', null,
    'whatsapp_community_url', null
  ),
  'BEAUTY CURE | STYLE'
)
on conflict (id) do nothing;

create or replace function public.get_catalog_institutional_content_controlled()
returns table(
  about_title text, about_body text, about_image_url text,
  purchase_title text, purchase_intro text, purchase_sections jsonb,
  legal_name text, tax_id text, location_text text,
  payment_title text, payment_methods jsonb,
  connect_title text, connect_message text, channels jsonb,
  footer_label text, updated_at timestamptz
)
language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles p where p.id=v_actor
      and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')
  ) then raise exception using errcode='42501', message='LIHEN_CATALOG_READ_FORBIDDEN'; end if;
  return query
  select c.about_title,c.about_body,c.about_image_url,c.purchase_title,c.purchase_intro,
         c.purchase_sections,c.legal_name,c.tax_id,c.location_text,c.payment_title,
         c.payment_methods,c.connect_title,c.connect_message,c.channels,c.footer_label,c.updated_at
  from public.catalog_institutional_content c where c.id='default';
end;
$function$;

create or replace function public.update_catalog_institutional_content_controlled(p_payload jsonb)
returns void language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid := auth.uid();
  v_channels jsonb;
  v_payments jsonb;
  v_sections jsonb;
  v_value text;
begin
  if v_actor is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles p where p.id=v_actor
      and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then raise exception using errcode='42501', message='LIHEN_CATALOG_WRITE_FORBIDDEN'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode='22023', message='LIHEN_INSTITUTIONAL_PAYLOAD_INVALID';
  end if;

  v_channels := coalesce(p_payload->'channels',(select channels from public.catalog_institutional_content where id='default'));
  v_payments := coalesce(p_payload->'payment_methods',(select payment_methods from public.catalog_institutional_content where id='default'));
  v_sections := coalesce(p_payload->'purchase_sections',(select purchase_sections from public.catalog_institutional_content where id='default'));

  if jsonb_typeof(v_channels) <> 'object' or jsonb_typeof(v_payments) <> 'array' or jsonb_typeof(v_sections) <> 'array' then
    raise exception using errcode='22023', message='LIHEN_INSTITUTIONAL_STRUCTURE_INVALID';
  end if;

  for v_value in select value from jsonb_each_text(v_channels)
    where value is not null and btrim(value) <> ''
  loop
    if v_value !~* '^https://[^[:space:]]+$' then
      raise exception using errcode='22023', message='LIHEN_INSTITUTIONAL_CHANNEL_URL_INVALID', detail=v_value;
    end if;
  end loop;

  if p_payload ? 'about_image_url' then
    v_value := nullif(btrim(p_payload->>'about_image_url'),'');
    if v_value is not null and v_value !~* '^https://[^[:space:]]+$' then
      raise exception using errcode='22023', message='LIHEN_INSTITUTIONAL_IMAGE_URL_INVALID';
    end if;
  end if;

  update public.catalog_institutional_content c
  set about_title=case when p_payload?'about_title' then coalesce(nullif(btrim(p_payload->>'about_title'),''),c.about_title) else c.about_title end,
      about_body=case when p_payload?'about_body' then coalesce(p_payload->>'about_body','') else c.about_body end,
      about_image_url=case when p_payload?'about_image_url' then nullif(btrim(p_payload->>'about_image_url'),'') else c.about_image_url end,
      purchase_title=case when p_payload?'purchase_title' then coalesce(nullif(btrim(p_payload->>'purchase_title'),''),c.purchase_title) else c.purchase_title end,
      purchase_intro=case when p_payload?'purchase_intro' then coalesce(p_payload->>'purchase_intro','') else c.purchase_intro end,
      purchase_sections=v_sections,
      legal_name=case when p_payload?'legal_name' then coalesce(nullif(btrim(p_payload->>'legal_name'),''),c.legal_name) else c.legal_name end,
      tax_id=case when p_payload?'tax_id' then nullif(btrim(p_payload->>'tax_id'),'') else c.tax_id end,
      location_text=case when p_payload?'location_text' then nullif(btrim(p_payload->>'location_text'),'') else c.location_text end,
      payment_title=case when p_payload?'payment_title' then coalesce(nullif(btrim(p_payload->>'payment_title'),''),c.payment_title) else c.payment_title end,
      payment_methods=v_payments,
      connect_title=case when p_payload?'connect_title' then coalesce(nullif(btrim(p_payload->>'connect_title'),''),c.connect_title) else c.connect_title end,
      connect_message=case when p_payload?'connect_message' then coalesce(p_payload->>'connect_message','') else c.connect_message end,
      channels=v_channels,
      footer_label=case when p_payload?'footer_label' then coalesce(nullif(btrim(p_payload->>'footer_label'),''),c.footer_label) else c.footer_label end,
      updated_at=now(), updated_by=v_actor
  where c.id='default';

  insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata)
  values (gen_random_uuid(),'CATALOG_INSTITUTIONAL_CONTENT_UPDATED','CATALOG_INSTITUTIONAL_CONTENT',null,now(),v_actor,
          jsonb_build_object('fields',coalesce((select jsonb_agg(k) from jsonb_object_keys(p_payload) k),'[]'::jsonb)),
          jsonb_build_object('phase','4.11'));
end;
$function$;

create or replace function public.capture_catalog_institutional_snapshot_controlled(p_catalog_version_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid := auth.uid(); v_status text;
begin
  if v_actor is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then raise exception using errcode='42501', message='LIHEN_CATALOG_WRITE_FORBIDDEN'; end if;

  select cv.status into v_status from public.catalog_versions cv
  where cv.id=p_catalog_version_id for update;
  if v_status is null then raise exception using errcode='P0002', message='LIHEN_CATALOG_VERSION_NOT_FOUND'; end if;
  if v_status <> 'DRAFT' then raise exception using errcode='55000', message='LIHEN_CATALOG_VERSION_NOT_DRAFT'; end if;

  insert into public.catalog_institutional_snapshots(
    catalog_version_id,about_title,about_body,about_image_url,purchase_title,purchase_intro,purchase_sections,
    legal_name,tax_id,location_text,payment_title,payment_methods,connect_title,connect_message,channels,footer_label,
    captured_at,captured_by
  )
  select p_catalog_version_id,c.about_title,c.about_body,c.about_image_url,c.purchase_title,c.purchase_intro,c.purchase_sections,
         c.legal_name,c.tax_id,c.location_text,c.payment_title,c.payment_methods,c.connect_title,c.connect_message,c.channels,c.footer_label,
         now(),v_actor
  from public.catalog_institutional_content c where c.id='default'
  on conflict (catalog_version_id) do update
  set about_title=excluded.about_title, about_body=excluded.about_body, about_image_url=excluded.about_image_url,
      purchase_title=excluded.purchase_title, purchase_intro=excluded.purchase_intro, purchase_sections=excluded.purchase_sections,
      legal_name=excluded.legal_name, tax_id=excluded.tax_id, location_text=excluded.location_text,
      payment_title=excluded.payment_title, payment_methods=excluded.payment_methods,
      connect_title=excluded.connect_title, connect_message=excluded.connect_message, channels=excluded.channels,
      footer_label=excluded.footer_label, captured_at=excluded.captured_at, captured_by=excluded.captured_by;

  insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata)
  values (gen_random_uuid(),'CATALOG_INSTITUTIONAL_SNAPSHOT_CAPTURED','CATALOG_VERSION',p_catalog_version_id,now(),v_actor,
          jsonb_build_object('captured',true),jsonb_build_object('phase','4.11'));
end;
$function$;

create or replace function public.get_catalog_institutional_snapshot_controlled(p_catalog_version_id uuid)
returns table(
  about_title text, about_body text, about_image_url text,
  purchase_title text, purchase_intro text, purchase_sections jsonb,
  legal_name text, tax_id text, location_text text,
  payment_title text, payment_methods jsonb,
  connect_title text, connect_message text, channels jsonb,
  footer_label text, captured_at timestamptz
)
language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')
  ) then raise exception using errcode='42501', message='LIHEN_CATALOG_READ_FORBIDDEN'; end if;
  return query
  select s.about_title,s.about_body,s.about_image_url,s.purchase_title,s.purchase_intro,s.purchase_sections,
         s.legal_name,s.tax_id,s.location_text,s.payment_title,s.payment_methods,s.connect_title,s.connect_message,
         s.channels,s.footer_label,s.captured_at
  from public.catalog_institutional_snapshots s where s.catalog_version_id=p_catalog_version_id;
end;
$function$;

create or replace function public.validate_pdf_catalog_version_controlled(p_catalog_version_id uuid)
returns table(check_name text, status text, issue_count bigint)
language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE'
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
  select 'INSTITUTIONAL_SNAPSHOT',case when count(*)=1 then 'PASS' else 'FAIL' end,
         case when count(*)=1 then 0 else 1 end
  from public.catalog_institutional_snapshots s where s.catalog_version_id=p_catalog_version_id;
end;
$function$;

create or replace function public.activate_pdf_catalog_version_controlled(p_catalog_version_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid := auth.uid(); v_status text; v_failures bigint;
begin
  if v_actor is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then raise exception using errcode='42501', message='LIHEN_CATALOG_WRITE_FORBIDDEN'; end if;

  select cv.status into v_status from public.catalog_versions cv where cv.id=p_catalog_version_id for update;
  if v_status is null then raise exception using errcode='P0002', message='LIHEN_CATALOG_VERSION_NOT_FOUND'; end if;
  if v_status <> 'DRAFT' then raise exception using errcode='55000', message='LIHEN_CATALOG_VERSION_NOT_DRAFT'; end if;

  select count(*) into v_failures from public.validate_pdf_catalog_version_controlled(p_catalog_version_id) v where v.status='FAIL';
  if v_failures>0 then raise exception using errcode='23514', message='LIHEN_CATALOG_VALIDATION_FAILED',detail=v_failures::text; end if;

  update public.catalog_versions
  set status='ACTIVE',effective_at=coalesce(effective_at,now()),activated_at=now(),activated_by=v_actor
  where id=p_catalog_version_id;

  insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata)
  values (gen_random_uuid(),'CATALOG_VERSION_ACTIVATED','CATALOG_VERSION',p_catalog_version_id,now(),v_actor,
          jsonb_build_object('status','ACTIVE'),jsonb_build_object('phase','4'));
end;
$function$;

revoke all on function public.get_catalog_institutional_content_controlled() from public, anon;
revoke all on function public.update_catalog_institutional_content_controlled(jsonb) from public, anon;
revoke all on function public.capture_catalog_institutional_snapshot_controlled(uuid) from public, anon;
revoke all on function public.get_catalog_institutional_snapshot_controlled(uuid) from public, anon;
grant execute on function public.get_catalog_institutional_content_controlled() to authenticated;
grant execute on function public.update_catalog_institutional_content_controlled(jsonb) to authenticated;
grant execute on function public.capture_catalog_institutional_snapshot_controlled(uuid) to authenticated;
grant execute on function public.get_catalog_institutional_snapshot_controlled(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('catalog-assets','catalog-assets',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "catalog_assets_owner_admin_insert" on storage.objects for insert to authenticated
with check (
  bucket_id='catalog-assets' and exists (
    select 1 from public.profiles p where p.id=auth.uid()
      and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  )
);
create policy "catalog_assets_owner_admin_update" on storage.objects for update to authenticated
using (
  bucket_id='catalog-assets' and exists (
    select 1 from public.profiles p where p.id=auth.uid()
      and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  )
)
with check (
  bucket_id='catalog-assets' and exists (
    select 1 from public.profiles p where p.id=auth.uid()
      and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  )
);
create policy "catalog_assets_owner_admin_delete" on storage.objects for delete to authenticated
using (
  bucket_id='catalog-assets' and exists (
    select 1 from public.profiles p where p.id=auth.uid()
      and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  )
);

comment on table public.catalog_institutional_content is
  'Editable current institutional content for future catalog versions. Not product master data.';
comment on table public.catalog_institutional_snapshots is
  'Immutable-by-version institutional content captured while a catalog version is DRAFT and required before activation.';
