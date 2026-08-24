create or replace function public.update_catalog_institutional_content_controlled(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_channels jsonb;
  v_payments jsonb;
  v_sections jsonb;
  v_value text;
  v_aggregate_id uuid := (md5('catalog_institutional_content:default'))::uuid;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=v_actor
      and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_CATALOG_WRITE_FORBIDDEN';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode='22023', message='LIHEN_INSTITUTIONAL_PAYLOAD_INVALID';
  end if;

  v_channels := coalesce(p_payload->'channels',(select channels from public.catalog_institutional_content where id='default'));
  v_payments := coalesce(p_payload->'payment_methods',(select payment_methods from public.catalog_institutional_content where id='default'));
  v_sections := coalesce(p_payload->'purchase_sections',(select purchase_sections from public.catalog_institutional_content where id='default'));

  if jsonb_typeof(v_channels) <> 'object' or jsonb_typeof(v_payments) <> 'array' or jsonb_typeof(v_sections) <> 'array' then
    raise exception using errcode='22023', message='LIHEN_INSTITUTIONAL_STRUCTURE_INVALID';
  end if;

  for v_value in
    select value
    from jsonb_each_text(v_channels)
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
  set about_title = case when p_payload ? 'about_title' then coalesce(nullif(btrim(p_payload->>'about_title'),''),c.about_title) else c.about_title end,
      about_body = case when p_payload ? 'about_body' then coalesce(p_payload->>'about_body','') else c.about_body end,
      about_image_url = case when p_payload ? 'about_image_url' then nullif(btrim(p_payload->>'about_image_url'),'') else c.about_image_url end,
      purchase_title = case when p_payload ? 'purchase_title' then coalesce(nullif(btrim(p_payload->>'purchase_title'),''),c.purchase_title) else c.purchase_title end,
      purchase_intro = case when p_payload ? 'purchase_intro' then coalesce(p_payload->>'purchase_intro','') else c.purchase_intro end,
      purchase_sections = v_sections,
      legal_name = case when p_payload ? 'legal_name' then coalesce(nullif(btrim(p_payload->>'legal_name'),''),c.legal_name) else c.legal_name end,
      tax_id = case when p_payload ? 'tax_id' then nullif(btrim(p_payload->>'tax_id'),'') else c.tax_id end,
      location_text = case when p_payload ? 'location_text' then nullif(btrim(p_payload->>'location_text'),'') else c.location_text end,
      payment_title = case when p_payload ? 'payment_title' then coalesce(nullif(btrim(p_payload->>'payment_title'),''),c.payment_title) else c.payment_title end,
      payment_methods = v_payments,
      connect_title = case when p_payload ? 'connect_title' then coalesce(nullif(btrim(p_payload->>'connect_title'),''),c.connect_title) else c.connect_title end,
      connect_message = case when p_payload ? 'connect_message' then coalesce(p_payload->>'connect_message','') else c.connect_message end,
      channels = v_channels,
      footer_label = case when p_payload ? 'footer_label' then coalesce(nullif(btrim(p_payload->>'footer_label'),''),c.footer_label) else c.footer_label end,
      updated_at = now(),
      updated_by = v_actor
  where c.id='default';

  insert into public.domain_events(id,event_type,aggregate_type,aggregate_id,occurred_at,actor_id,payload,metadata)
  values (
    gen_random_uuid(),
    'CATALOG_INSTITUTIONAL_CONTENT_UPDATED',
    'CATALOG_INSTITUTIONAL_CONTENT',
    v_aggregate_id,
    now(),
    v_actor,
    jsonb_build_object('fields',coalesce((select jsonb_agg(k) from jsonb_object_keys(p_payload) k),'[]'::jsonb)),
    jsonb_build_object('phase','4.11')
  );
end;
$function$;
