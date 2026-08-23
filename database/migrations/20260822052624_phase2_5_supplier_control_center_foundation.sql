-- FASE 2.5A — Controlled supplier management in DEV.
-- Direct writes remain closed. OWNER/ADMIN ACTIVE can create/update only through idempotent RPCs.

create table if not exists lihen_private.supplier_write_operations (
  operation_key text primary key,
  operation_type text not null,
  actor_id uuid not null,
  supplier_id uuid not null,
  request_fingerprint text not null,
  result_snapshot jsonb,
  created_at timestamptz not null default now()
);

revoke all on lihen_private.supplier_write_operations from public, anon, authenticated;
grant all on lihen_private.supplier_write_operations to service_role;

create or replace function public.create_supplier_controlled(
  p_operation_key text,
  p_id uuid,
  p_business_name text,
  p_contact_name text,
  p_whatsapp text,
  p_email text,
  p_city text,
  p_average_delivery_days integer,
  p_notes text,
  p_status text
)
returns table(
  id uuid, business_name text, normalized_name text, contact_name text,
  whatsapp text, email text, city text, average_delivery_days integer,
  notes text, status text, created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_name text;
  v_normalized text;
  v_fingerprint text;
  v_existing lihen_private.supplier_write_operations%rowtype;
  v_result public.suppliers%rowtype;
begin
  if v_actor_id is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then
    raise exception using errcode='42501', message='LIHEN_SUPPLIER_CREATE_FORBIDDEN';
  end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023', message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_id is null then raise exception using errcode='22023', message='LIHEN_SUPPLIER_ID_REQUIRED'; end if;
  v_name := regexp_replace(btrim(coalesce(p_business_name,'')), '\s+', ' ', 'g');
  if length(v_name)=0 then raise exception using errcode='22023', message='LIHEN_SUPPLIER_BUSINESS_NAME_REQUIRED'; end if;
  v_normalized := lower(v_name);
  if p_average_delivery_days is not null and p_average_delivery_days < 0 then raise exception using errcode='22023', message='LIHEN_SUPPLIER_DELIVERY_DAYS_INVALID'; end if;
  if p_status not in ('ACTIVE','INACTIVE') then raise exception using errcode='22023', message='LIHEN_SUPPLIER_STATUS_INVALID'; end if;

  v_fingerprint := md5(concat_ws('|',p_id::text,v_normalized,coalesce(nullif(btrim(p_contact_name),''),'<NULL>'),coalesce(nullif(btrim(p_whatsapp),''),'<NULL>'),coalesce(nullif(btrim(p_email),''),'<NULL>'),coalesce(nullif(btrim(p_city),''),'<NULL>'),coalesce(p_average_delivery_days::text,'<NULL>'),coalesce(nullif(btrim(p_notes),''),'<NULL>'),p_status));
  select o.* into v_existing from lihen_private.supplier_write_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'CREATE_SUPPLIER' or v_existing.actor_id<>v_actor_id or v_existing.supplier_id<>p_id or v_existing.request_fingerprint is distinct from v_fingerprint or v_existing.result_snapshot is null then
      raise exception using errcode='23505', message='LIHEN_SUPPLIER_WRITE_OPERATION_CONFLICT';
    end if;
    return query select
      (v_existing.result_snapshot->>'id')::uuid,
      v_existing.result_snapshot->>'business_name', v_existing.result_snapshot->>'normalized_name',
      nullif(v_existing.result_snapshot->>'contact_name',''), nullif(v_existing.result_snapshot->>'whatsapp',''),
      nullif(v_existing.result_snapshot->>'email',''), nullif(v_existing.result_snapshot->>'city',''),
      nullif(v_existing.result_snapshot->>'average_delivery_days','')::integer,
      nullif(v_existing.result_snapshot->>'notes',''), v_existing.result_snapshot->>'status',
      (v_existing.result_snapshot->>'created_at')::timestamptz, (v_existing.result_snapshot->>'updated_at')::timestamptz;
    return;
  end if;

  if exists(select 1 from public.suppliers s where s.id=p_id or s.normalized_name=v_normalized) then
    raise exception using errcode='23505', message='LIHEN_SUPPLIER_ALREADY_EXISTS';
  end if;

  insert into public.suppliers(id,business_name,normalized_name,contact_name,whatsapp,email,city,average_delivery_days,notes,status)
  values(p_id,v_name,v_normalized,nullif(btrim(p_contact_name),''),nullif(btrim(p_whatsapp),''),nullif(btrim(p_email),''),nullif(btrim(p_city),''),p_average_delivery_days,nullif(btrim(p_notes),''),p_status)
  returning * into v_result;

  insert into lihen_private.supplier_write_operations(operation_key,operation_type,actor_id,supplier_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'CREATE_SUPPLIER',v_actor_id,p_id,v_fingerprint,to_jsonb(v_result));

  return query select v_result.id,v_result.business_name,v_result.normalized_name,v_result.contact_name,v_result.whatsapp,v_result.email,v_result.city,v_result.average_delivery_days,v_result.notes,v_result.status,v_result.created_at,v_result.updated_at;
end;
$$;

create or replace function public.update_supplier_controlled(
  p_operation_key text,
  p_supplier_id uuid,
  p_business_name text,
  p_contact_name text,
  p_whatsapp text,
  p_email text,
  p_city text,
  p_average_delivery_days integer,
  p_notes text,
  p_status text
)
returns table(
  id uuid, business_name text, normalized_name text, contact_name text,
  whatsapp text, email text, city text, average_delivery_days integer,
  notes text, status text, created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_name text;
  v_normalized text;
  v_fingerprint text;
  v_existing lihen_private.supplier_write_operations%rowtype;
  v_result public.suppliers%rowtype;
begin
  if v_actor_id is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then
    raise exception using errcode='42501', message='LIHEN_SUPPLIER_UPDATE_FORBIDDEN';
  end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023', message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_supplier_id is null then raise exception using errcode='22023', message='LIHEN_SUPPLIER_ID_REQUIRED'; end if;
  v_name := regexp_replace(btrim(coalesce(p_business_name,'')), '\s+', ' ', 'g');
  if length(v_name)=0 then raise exception using errcode='22023', message='LIHEN_SUPPLIER_BUSINESS_NAME_REQUIRED'; end if;
  v_normalized := lower(v_name);
  if p_average_delivery_days is not null and p_average_delivery_days < 0 then raise exception using errcode='22023', message='LIHEN_SUPPLIER_DELIVERY_DAYS_INVALID'; end if;
  if p_status not in ('ACTIVE','INACTIVE') then raise exception using errcode='22023', message='LIHEN_SUPPLIER_STATUS_INVALID'; end if;

  v_fingerprint := md5(concat_ws('|',p_supplier_id::text,v_normalized,coalesce(nullif(btrim(p_contact_name),''),'<NULL>'),coalesce(nullif(btrim(p_whatsapp),''),'<NULL>'),coalesce(nullif(btrim(p_email),''),'<NULL>'),coalesce(nullif(btrim(p_city),''),'<NULL>'),coalesce(p_average_delivery_days::text,'<NULL>'),coalesce(nullif(btrim(p_notes),''),'<NULL>'),p_status));
  select o.* into v_existing from lihen_private.supplier_write_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'UPDATE_SUPPLIER' or v_existing.actor_id<>v_actor_id or v_existing.supplier_id<>p_supplier_id or v_existing.request_fingerprint is distinct from v_fingerprint or v_existing.result_snapshot is null then
      raise exception using errcode='23505', message='LIHEN_SUPPLIER_WRITE_OPERATION_CONFLICT';
    end if;
    return query select
      (v_existing.result_snapshot->>'id')::uuid,
      v_existing.result_snapshot->>'business_name', v_existing.result_snapshot->>'normalized_name',
      nullif(v_existing.result_snapshot->>'contact_name',''), nullif(v_existing.result_snapshot->>'whatsapp',''),
      nullif(v_existing.result_snapshot->>'email',''), nullif(v_existing.result_snapshot->>'city',''),
      nullif(v_existing.result_snapshot->>'average_delivery_days','')::integer,
      nullif(v_existing.result_snapshot->>'notes',''), v_existing.result_snapshot->>'status',
      (v_existing.result_snapshot->>'created_at')::timestamptz, (v_existing.result_snapshot->>'updated_at')::timestamptz;
    return;
  end if;

  if not exists(select 1 from public.suppliers s where s.id=p_supplier_id) then raise exception using errcode='P0002', message='LIHEN_SUPPLIER_NOT_FOUND'; end if;
  if exists(select 1 from public.suppliers s where s.normalized_name=v_normalized and s.id<>p_supplier_id) then raise exception using errcode='23505', message='LIHEN_SUPPLIER_ALREADY_EXISTS'; end if;

  update public.suppliers s set business_name=v_name, normalized_name=v_normalized, contact_name=nullif(btrim(p_contact_name),''), whatsapp=nullif(btrim(p_whatsapp),''), email=nullif(btrim(p_email),''), city=nullif(btrim(p_city),''), average_delivery_days=p_average_delivery_days, notes=nullif(btrim(p_notes),''), status=p_status, updated_at=now()
  where s.id=p_supplier_id returning * into v_result;

  insert into lihen_private.supplier_write_operations(operation_key,operation_type,actor_id,supplier_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'UPDATE_SUPPLIER',v_actor_id,p_supplier_id,v_fingerprint,to_jsonb(v_result));

  return query select v_result.id,v_result.business_name,v_result.normalized_name,v_result.contact_name,v_result.whatsapp,v_result.email,v_result.city,v_result.average_delivery_days,v_result.notes,v_result.status,v_result.created_at,v_result.updated_at;
end;
$$;

revoke all on function public.create_supplier_controlled(text,uuid,text,text,text,text,text,integer,text,text) from public, anon;
revoke all on function public.update_supplier_controlled(text,uuid,text,text,text,text,text,integer,text,text) from public, anon;
grant execute on function public.create_supplier_controlled(text,uuid,text,text,text,text,text,integer,text,text) to authenticated;
grant execute on function public.update_supplier_controlled(text,uuid,text,text,text,text,text,integer,text,text) to authenticated;

comment on function public.create_supplier_controlled(text,uuid,text,text,text,text,text,integer,text,text) is 'FASE 2.5A controlled supplier create. OWNER/ADMIN ACTIVE only; idempotent.';
comment on function public.update_supplier_controlled(text,uuid,text,text,text,text,text,integer,text,text) is 'FASE 2.5A controlled supplier update. OWNER/ADMIN ACTIVE only; idempotent.';
