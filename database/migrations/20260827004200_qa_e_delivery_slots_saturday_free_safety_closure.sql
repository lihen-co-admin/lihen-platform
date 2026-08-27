create table if not exists lihen_private.delivery_service_policies (
  policy_key text primary key,policy_status text not null check(policy_status in ('ACTIVE','DISABLED_PENDING_APPROVAL','ARCHIVED')),
  coverage_scope text not null,free_shipping_threshold numeric(12,2),applies_weekday integer check(applies_weekday between 0 and 6),
  source_reference text not null,public_label text not null,public_detail text not null,updated_at timestamptz not null default now()
);
revoke all on lihen_private.delivery_service_policies from public,anon,authenticated; grant select on lihen_private.delivery_service_policies to postgres;
insert into lihen_private.delivery_service_policies(policy_key,policy_status,coverage_scope,free_shipping_threshold,applies_weekday,source_reference,public_label,public_detail) values
('STANDARD_NATIONAL','ACTIVE','COLOMBIA',100000,null,'POLITICA_ENVIOS_LIHENCO_V1_JULIO_2026','Envío gratis desde $100.000 COP','Cali: 1 a 3 días hábiles. Ciudades principales: 3 a 5 días hábiles. Municipios y zonas rurales: 5 a 8 días hábiles sujetos a cobertura.'),
('SATURDAY_FREE_CALI','DISABLED_PENDING_APPROVAL','CALI',null,6,'NO_APPROVED_PUBLIC_SOURCE_FOUND_2026-08-26','Sábado con entrega gratis','Beneficio configurable para Cali. No se publica ni se aplica hasta contar con condiciones, cobertura, cupos y aprobación comercial verificadas.')
on conflict(policy_key) do update set policy_status=excluded.policy_status,coverage_scope=excluded.coverage_scope,free_shipping_threshold=excluded.free_shipping_threshold,applies_weekday=excluded.applies_weekday,source_reference=excluded.source_reference,public_label=excluded.public_label,public_detail=excluded.public_detail,updated_at=now();
create table if not exists lihen_private.delivery_slots (
  slot_id uuid primary key default gen_random_uuid(),service_date date not null,window_code text not null,window_label text not null,
  capacity integer not null check(capacity>=0),reserved_count integer not null default 0 check(reserved_count>=0),
  slot_status text not null default 'OPEN' check(slot_status in ('OPEN','CLOSED','CANCELLED')),
  policy_key text references lihen_private.delivery_service_policies(policy_key),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(service_date,window_code),check(reserved_count<=capacity)
);
revoke all on lihen_private.delivery_slots from public,anon,authenticated; grant select on lihen_private.delivery_slots to postgres;
create table if not exists lihen_private.delivery_slot_reservations (
  reservation_id uuid primary key default gen_random_uuid(),slot_id uuid not null references lihen_private.delivery_slots(slot_id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,reservation_status text not null default 'RESERVED' check(reservation_status in ('RESERVED','RELEASED','FULFILLED','CANCELLED')),
  operation_key text not null unique,actor_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index if not exists delivery_slot_reservations_one_active_per_order on lihen_private.delivery_slot_reservations(order_id) where reservation_status='RESERVED';
revoke all on lihen_private.delivery_slot_reservations from public,anon,authenticated; grant select on lihen_private.delivery_slot_reservations to postgres;
create or replace function public.get_storefront_delivery_policy_controlled()
returns table(policy_key text,policy_status text,coverage_scope text,free_shipping_threshold numeric,applies_weekday integer,public_label text,public_detail text)
language sql security definer set search_path='' as $$ select p.policy_key,p.policy_status,p.coverage_scope,p.free_shipping_threshold,p.applies_weekday,p.public_label,p.public_detail from lihen_private.delivery_service_policies p where p.policy_status='ACTIVE' order by p.policy_key $$;
revoke all on function public.get_storefront_delivery_policy_controlled() from public; grant execute on function public.get_storefront_delivery_policy_controlled() to anon,authenticated,postgres;
create or replace function public.configure_delivery_slot_controlled(p_service_date date,p_window_code text,p_window_label text,p_capacity integer,p_policy_key text default null)
returns uuid language plpgsql security definer set search_path='' as $$ declare v_actor uuid:=auth.uid(); v_slot uuid; begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_DELIVERY_SLOT_CONFIG_FORBIDDEN'; end if;
 if p_capacity<0 then raise exception using errcode='22023',message='LIHEN_DELIVERY_SLOT_CAPACITY_INVALID'; end if;
 if coalesce(trim(p_window_code),'')='' or coalesce(trim(p_window_label),'')='' then raise exception using errcode='22023',message='LIHEN_DELIVERY_SLOT_WINDOW_REQUIRED'; end if;
 if p_policy_key is not null and not exists(select 1 from lihen_private.delivery_service_policies p where p.policy_key=p_policy_key) then raise exception using errcode='22023',message='LIHEN_DELIVERY_POLICY_UNKNOWN'; end if;
 insert into lihen_private.delivery_slots(service_date,window_code,window_label,capacity,policy_key) values(p_service_date,trim(p_window_code),trim(p_window_label),p_capacity,p_policy_key)
 on conflict(service_date,window_code) do update set window_label=excluded.window_label,capacity=excluded.capacity,policy_key=excluded.policy_key,updated_at=now() returning slot_id into v_slot; return v_slot; end $$;
revoke all on function public.configure_delivery_slot_controlled(date,text,text,integer,text) from public,anon; grant execute on function public.configure_delivery_slot_controlled(date,text,text,integer,text) to authenticated,postgres;
create or replace function public.reserve_delivery_slot_controlled(p_operation_key text,p_slot_id uuid,p_order_id uuid)
returns table(reservation_id uuid,slot_id uuid,order_id uuid,reservation_status text,remaining_capacity integer)
language plpgsql security definer set search_path='' as $$ declare v_actor uuid:=auth.uid(); v_slot lihen_private.delivery_slots%rowtype; v_res lihen_private.delivery_slot_reservations%rowtype; begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_DELIVERY_SLOT_RESERVE_FORBIDDEN'; end if;
 if coalesce(trim(p_operation_key),'')='' then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
 select * into v_res from lihen_private.delivery_slot_reservations r where r.operation_key=p_operation_key;
 if found then return query select v_res.reservation_id,v_res.slot_id,v_res.order_id,v_res.reservation_status,(select greatest(s.capacity-s.reserved_count,0) from lihen_private.delivery_slots s where s.slot_id=v_res.slot_id); return; end if;
 if not exists(select 1 from public.orders o where o.id=p_order_id) then raise exception using errcode='P0002',message='LIHEN_ORDER_NOT_FOUND'; end if;
 select * into v_slot from lihen_private.delivery_slots s where s.slot_id=p_slot_id for update;
 if not found then raise exception using errcode='P0002',message='LIHEN_DELIVERY_SLOT_NOT_FOUND'; end if;
 if v_slot.slot_status<>'OPEN' then raise exception using errcode='22023',message='LIHEN_DELIVERY_SLOT_NOT_OPEN'; end if;
 if v_slot.reserved_count>=v_slot.capacity then raise exception using errcode='22023',message='LIHEN_DELIVERY_SLOT_FULL'; end if;
 if exists(select 1 from lihen_private.delivery_slot_reservations r where r.order_id=p_order_id and r.reservation_status='RESERVED') then raise exception using errcode='23505',message='LIHEN_ORDER_ALREADY_HAS_DELIVERY_SLOT'; end if;
 insert into lihen_private.delivery_slot_reservations(slot_id,order_id,operation_key,actor_id) values(p_slot_id,p_order_id,trim(p_operation_key),v_actor) returning * into v_res;
 update lihen_private.delivery_slots set reserved_count=reserved_count+1,updated_at=now() where delivery_slots.slot_id=p_slot_id;
 return query select v_res.reservation_id,v_res.slot_id,v_res.order_id,v_res.reservation_status,greatest(v_slot.capacity-v_slot.reserved_count-1,0); end $$;
revoke all on function public.reserve_delivery_slot_controlled(text,uuid,uuid) from public,anon; grant execute on function public.reserve_delivery_slot_controlled(text,uuid,uuid) to authenticated,postgres;
create or replace view lihen_private.qa_e_delivery_saturday_free_closure as
with policies as (select count(*) filter(where policy_key='STANDARD_NATIONAL' and policy_status='ACTIVE' and free_shipping_threshold=100000)::int standard_policy,count(*) filter(where policy_key='SATURDAY_FREE_CALI' and policy_status='DISABLED_PENDING_APPROVAL' and applies_weekday=6)::int saturday_safe_default from lihen_private.delivery_service_policies),
funcs as (select count(*) filter(where proname='get_storefront_delivery_policy_controlled')::int public_policy_rpc,count(*) filter(where proname='configure_delivery_slot_controlled')::int slot_config_rpc,count(*) filter(where proname='reserve_delivery_slot_controlled')::int reserve_rpc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('get_storefront_delivery_policy_controlled','configure_delivery_slot_controlled','reserve_delivery_slot_controlled')),
slots as (select count(*)::int slots,count(*) filter(where reserved_count>capacity)::int overbooked from lihen_private.delivery_slots),style as (select count(*) filter(where status='ACTIVE' and visible_on_website)::int style_visible from public.products where business_line='STYLE')
select case when p.standard_policy=1 and p.saturday_safe_default=1 and f.public_policy_rpc=1 and f.slot_config_rpc=1 and f.reserve_rpc=1 and s.overbooked=0 and st.style_visible=0 then 'PASS' else 'BLOCKED' end closure_status,p.standard_policy,p.saturday_safe_default,f.public_policy_rpc,f.slot_config_rpc,f.reserve_rpc,s.slots,s.overbooked,st.style_visible,'OPERATIONAL_CAPACITY_READY_SATURDAY_PROMO_PENDING_APPROVED_RULE'::text closure_mode,jsonb_build_array('STANDARD_FREE_SHIPPING_THRESHOLD_100000','DELIVERY_SLOT_CAPACITY_GUARD','NO_DOUBLE_ACTIVE_SLOT_PER_ORDER','IDEMPOTENT_RESERVATION_OPERATION_KEY','OWNER_ADMIN_SLOT_CONTROL','SATURDAY_FREE_NOT_PUBLIC_UNTIL_APPROVED','WHATSAPP_REMAINS_CUSTOMER_CONFIRMATION_CHANNEL','NO_PRODUCTION_WRITES') contract from policies p cross join funcs f cross join slots s cross join style st;
revoke all on lihen_private.qa_e_delivery_saturday_free_closure from public,anon,authenticated; grant select on lihen_private.qa_e_delivery_saturday_free_closure to postgres;
insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select 'QA-E',case when closure_status='PASS' then 'PASS' else 'BLOCKED' end,'QA_E_DELIVERY_SATURDAY_FREE_SAFETY_CLOSURE_V1',jsonb_build_object('closure_mode',closure_mode,'standard_policy',standard_policy,'saturday_safe_default',saturday_safe_default,'public_policy_rpc',public_policy_rpc,'slot_config_rpc',slot_config_rpc,'reserve_rpc',reserve_rpc,'slots',slots,'overbooked',overbooked,'style_visible',style_visible,'contract',contract),jsonb_build_array('SATURDAY_FREE_PUBLIC_ACTIVATION_REQUIRES_APPROVED_COMMERCIAL_RULE_AND_CONFIGURED_CAPACITY'),'QA-E closes delivery capacity/slot and shipping-policy safety. Standard free shipping from COP 100000 is source-backed. Saturday-free stays disabled until coverage, dates and capacity are verified.',now()
from lihen_private.qa_e_delivery_saturday_free_closure
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
