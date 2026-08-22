-- FASE 2.8B: egresos, transferencias, reversiones seguras y cierres de caja.
-- No importa saldos legacy. Las ventas no se revierten desde Finanzas.
create table if not exists public.cash_closures(
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.financial_accounts(id) on delete restrict,
 expected_balance numeric(14,2) not null,counted_balance numeric(14,2) not null,variance numeric(14,2) not null,
 occurred_at timestamptz not null,notes text null,created_by uuid not null,created_at timestamptz not null default now()
);
alter table public.cash_closures enable row level security;
drop policy if exists cash_closures_admin_read on public.cash_closures;
create policy cash_closures_admin_read on public.cash_closures for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')));
revoke all on public.cash_closures from anon,authenticated;grant select on public.cash_closures to authenticated;

create or replace function public.record_expense_controlled(p_operation_key text,p_movement_id uuid,p_account_id uuid,p_amount numeric,p_occurred_at timestamptz,p_description text)
returns table(movement_id uuid,account_id uuid,amount_signed numeric,balance numeric) language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=auth.uid();v_fp text;v_existing lihen_private.financial_write_operations%rowtype;v_balance numeric;
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED';end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_FINANCE_FORBIDDEN';end if;
 if p_operation_key is null or btrim(p_operation_key)='' then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED';end if;
 if p_movement_id is null or p_account_id is null or p_amount is null or p_amount<=0 or p_description is null or btrim(p_description)='' then raise exception using errcode='22023',message='LIHEN_EXPENSE_FIELDS_INVALID';end if;
 if not exists(select 1 from public.financial_accounts a where a.id=p_account_id and a.status='ACTIVE') then raise exception using errcode='23503',message='LIHEN_FINANCIAL_ACCOUNT_NOT_FOUND';end if;
 v_fp:=md5(concat_ws('|',p_movement_id::text,p_account_id::text,p_amount::text,coalesce(p_occurred_at::text,'<NOW>'),btrim(p_description)));
 select * into v_existing from lihen_private.financial_write_operations where operation_key=btrim(p_operation_key);
 if found then if v_existing.operation_type<>'EXPENSE' or v_existing.actor_id<>v_actor or v_existing.movement_id<>p_movement_id or v_existing.request_fingerprint is distinct from v_fp then raise exception using errcode='23505',message='LIHEN_FINANCIAL_OPERATION_CONFLICT';end if;select b.balance into v_balance from public.financial_account_balances b where b.account_id=v_existing.account_id;return query select m.id,m.account_id,m.amount_signed,v_balance from public.financial_movements m where m.id=v_existing.movement_id;return;end if;
 insert into public.financial_movements(id,account_id,movement_type,amount_signed,occurred_at,description,reference_type)values(p_movement_id,p_account_id,'EXPENSE',-p_amount,coalesce(p_occurred_at,now()),btrim(p_description),'MANUAL_EXPENSE');
 insert into lihen_private.financial_write_operations(operation_key,operation_type,actor_id,account_id,movement_id,request_fingerprint,result_snapshot)values(btrim(p_operation_key),'EXPENSE',v_actor,p_account_id,p_movement_id,v_fp,jsonb_build_object('movement_id',p_movement_id));
 select b.balance into v_balance from public.financial_account_balances b where b.account_id=p_account_id;return query select p_movement_id,p_account_id,-p_amount,v_balance;
end;$fn$;

create or replace function public.transfer_financial_funds_controlled(p_operation_key text,p_transfer_id uuid,p_out_movement_id uuid,p_in_movement_id uuid,p_from_account_id uuid,p_to_account_id uuid,p_amount numeric,p_occurred_at timestamptz,p_description text)
returns table(transfer_id uuid,from_account_id uuid,to_account_id uuid,amount numeric,from_balance numeric,to_balance numeric) language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=auth.uid();v_fp text;v_existing lihen_private.financial_write_operations%rowtype;v_from_balance numeric;v_to_balance numeric;
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED';end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_FINANCE_FORBIDDEN';end if;
 if p_operation_key is null or btrim(p_operation_key)='' or p_transfer_id is null or p_out_movement_id is null or p_in_movement_id is null or p_from_account_id is null or p_to_account_id is null then raise exception using errcode='22023',message='LIHEN_TRANSFER_FIELDS_REQUIRED';end if;
 if p_from_account_id=p_to_account_id or p_amount is null or p_amount<=0 or p_description is null or btrim(p_description)='' then raise exception using errcode='22023',message='LIHEN_TRANSFER_INVALID';end if;
 v_fp:=md5(concat_ws('|',p_transfer_id::text,p_out_movement_id::text,p_in_movement_id::text,p_from_account_id::text,p_to_account_id::text,p_amount::text,coalesce(p_occurred_at::text,'<NOW>'),btrim(p_description)));
 select * into v_existing from lihen_private.financial_write_operations where operation_key=btrim(p_operation_key);
 if found then if v_existing.operation_type<>'TRANSFER' or v_existing.actor_id<>v_actor or v_existing.request_fingerprint is distinct from v_fp then raise exception using errcode='23505',message='LIHEN_FINANCIAL_OPERATION_CONFLICT';end if;select b.balance into v_from_balance from public.financial_account_balances b where b.account_id=p_from_account_id;select b.balance into v_to_balance from public.financial_account_balances b where b.account_id=p_to_account_id;return query select p_transfer_id,p_from_account_id,p_to_account_id,p_amount,v_from_balance,v_to_balance;return;end if;
 if not exists(select 1 from public.financial_accounts a where a.id=p_from_account_id and a.status='ACTIVE') or not exists(select 1 from public.financial_accounts a where a.id=p_to_account_id and a.status='ACTIVE') then raise exception using errcode='23503',message='LIHEN_FINANCIAL_ACCOUNT_NOT_FOUND';end if;
 select b.balance into v_from_balance from public.financial_account_balances b where b.account_id=p_from_account_id;if coalesce(v_from_balance,0)<p_amount then raise exception using errcode='22023',message='LIHEN_FINANCIAL_FUNDS_INSUFFICIENT';end if;
 insert into public.financial_movements(id,account_id,movement_type,amount_signed,occurred_at,description,reference_type,reference_id)values(p_out_movement_id,p_from_account_id,'TRANSFER_OUT',-p_amount,coalesce(p_occurred_at,now()),btrim(p_description),'TRANSFER',p_transfer_id),(p_in_movement_id,p_to_account_id,'TRANSFER_IN',p_amount,coalesce(p_occurred_at,now()),btrim(p_description),'TRANSFER',p_transfer_id);
 insert into lihen_private.financial_write_operations(operation_key,operation_type,actor_id,account_id,movement_id,request_fingerprint,result_snapshot)values(btrim(p_operation_key),'TRANSFER',v_actor,p_from_account_id,p_out_movement_id,v_fp,jsonb_build_object('transfer_id',p_transfer_id,'in_movement_id',p_in_movement_id,'to_account_id',p_to_account_id));
 select b.balance into v_from_balance from public.financial_account_balances b where b.account_id=p_from_account_id;select b.balance into v_to_balance from public.financial_account_balances b where b.account_id=p_to_account_id;return query select p_transfer_id,p_from_account_id,p_to_account_id,p_amount,v_from_balance,v_to_balance;
end;$fn$;

create or replace function public.reverse_financial_movement_controlled(p_operation_key text,p_reversal_movement_id uuid,p_original_movement_id uuid,p_occurred_at timestamptz,p_reason text)
returns table(reversal_movement_id uuid,original_movement_id uuid,account_id uuid,amount_signed numeric,balance numeric) language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=auth.uid();v_fp text;v_existing lihen_private.financial_write_operations%rowtype;v_original public.financial_movements%rowtype;v_balance numeric;
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED';end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_FINANCE_FORBIDDEN';end if;
 if p_operation_key is null or btrim(p_operation_key)='' or p_reversal_movement_id is null or p_original_movement_id is null or p_reason is null or btrim(p_reason)='' then raise exception using errcode='22023',message='LIHEN_REVERSAL_FIELDS_REQUIRED';end if;
 v_fp:=md5(concat_ws('|',p_reversal_movement_id::text,p_original_movement_id::text,coalesce(p_occurred_at::text,'<NOW>'),btrim(p_reason)));select * into v_existing from lihen_private.financial_write_operations where operation_key=btrim(p_operation_key);
 if found then if v_existing.operation_type<>'REVERSAL' or v_existing.actor_id<>v_actor or v_existing.movement_id<>p_reversal_movement_id or v_existing.request_fingerprint is distinct from v_fp then raise exception using errcode='23505',message='LIHEN_FINANCIAL_OPERATION_CONFLICT';end if;select b.balance into v_balance from public.financial_account_balances b where b.account_id=v_existing.account_id;return query select m.id,p_original_movement_id,m.account_id,m.amount_signed,v_balance from public.financial_movements m where m.id=v_existing.movement_id;return;end if;
 select * into v_original from public.financial_movements where id=p_original_movement_id;if not found then raise exception using errcode='P0002',message='LIHEN_FINANCIAL_MOVEMENT_NOT_FOUND';end if;if v_original.movement_type not in('EXPENSE','ADJUSTMENT') then raise exception using errcode='22023',message='LIHEN_REVERSAL_REQUIRES_DOMAIN_WORKFLOW';end if;if exists(select 1 from public.financial_movements m where m.reversal_of_id=p_original_movement_id) then raise exception using errcode='23505',message='LIHEN_FINANCIAL_MOVEMENT_ALREADY_REVERSED';end if;
 insert into public.financial_movements(id,account_id,movement_type,amount_signed,occurred_at,description,reference_type,reference_id,reversal_of_id)values(p_reversal_movement_id,v_original.account_id,'REVERSAL',-v_original.amount_signed,coalesce(p_occurred_at,now()),'Reversión: '||btrim(p_reason),'FINANCIAL_MOVEMENT',p_original_movement_id,p_original_movement_id);
 insert into lihen_private.financial_write_operations(operation_key,operation_type,actor_id,account_id,movement_id,request_fingerprint,result_snapshot)values(btrim(p_operation_key),'REVERSAL',v_actor,v_original.account_id,p_reversal_movement_id,v_fp,jsonb_build_object('original_movement_id',p_original_movement_id));select b.balance into v_balance from public.financial_account_balances b where b.account_id=v_original.account_id;return query select p_reversal_movement_id,p_original_movement_id,v_original.account_id,-v_original.amount_signed,v_balance;
end;$fn$;

create or replace function public.record_cash_closure_controlled(p_operation_key text,p_closure_id uuid,p_account_id uuid,p_counted_balance numeric,p_occurred_at timestamptz,p_notes text)
returns table(closure_id uuid,account_id uuid,expected_balance numeric,counted_balance numeric,variance numeric) language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=auth.uid();v_fp text;v_existing lihen_private.financial_write_operations%rowtype;v_expected numeric;v_variance numeric;
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED';end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_FINANCE_FORBIDDEN';end if;
 if p_operation_key is null or btrim(p_operation_key)='' or p_closure_id is null or p_account_id is null or p_counted_balance is null then raise exception using errcode='22023',message='LIHEN_CASH_CLOSURE_FIELDS_REQUIRED';end if;
 v_fp:=md5(concat_ws('|',p_closure_id::text,p_account_id::text,p_counted_balance::text,coalesce(p_occurred_at::text,'<NOW>'),coalesce(btrim(p_notes),'')));select * into v_existing from lihen_private.financial_write_operations where operation_key=btrim(p_operation_key);
 if found then if v_existing.operation_type<>'CASH_CLOSURE' or v_existing.actor_id<>v_actor or v_existing.request_fingerprint is distinct from v_fp then raise exception using errcode='23505',message='LIHEN_FINANCIAL_OPERATION_CONFLICT';end if;return query select c.id,c.account_id,c.expected_balance,c.counted_balance,c.variance from public.cash_closures c where c.id=(v_existing.result_snapshot->>'closure_id')::uuid;return;end if;
 if not exists(select 1 from public.financial_accounts a where a.id=p_account_id and a.status='ACTIVE') then raise exception using errcode='23503',message='LIHEN_FINANCIAL_ACCOUNT_NOT_FOUND';end if;select b.balance into v_expected from public.financial_account_balances b where b.account_id=p_account_id;v_expected:=coalesce(v_expected,0);v_variance:=p_counted_balance-v_expected;
 insert into public.cash_closures(id,account_id,expected_balance,counted_balance,variance,occurred_at,notes,created_by)values(p_closure_id,p_account_id,v_expected,p_counted_balance,v_variance,coalesce(p_occurred_at,now()),nullif(btrim(coalesce(p_notes,'')),''),v_actor);
 insert into lihen_private.financial_write_operations(operation_key,operation_type,actor_id,account_id,movement_id,request_fingerprint,result_snapshot)values(btrim(p_operation_key),'CASH_CLOSURE',v_actor,p_account_id,p_closure_id,v_fp,jsonb_build_object('closure_id',p_closure_id,'expected_balance',v_expected,'counted_balance',p_counted_balance,'variance',v_variance));return query select p_closure_id,p_account_id,v_expected,p_counted_balance,v_variance;
end;$fn$;

revoke all on function public.record_expense_controlled(text,uuid,uuid,numeric,timestamptz,text) from public,anon;
revoke all on function public.transfer_financial_funds_controlled(text,uuid,uuid,uuid,uuid,uuid,numeric,timestamptz,text) from public,anon;
revoke all on function public.reverse_financial_movement_controlled(text,uuid,uuid,timestamptz,text) from public,anon;
revoke all on function public.record_cash_closure_controlled(text,uuid,uuid,numeric,timestamptz,text) from public,anon;
grant execute on function public.record_expense_controlled(text,uuid,uuid,numeric,timestamptz,text) to authenticated,service_role;
grant execute on function public.transfer_financial_funds_controlled(text,uuid,uuid,uuid,uuid,uuid,numeric,timestamptz,text) to authenticated,service_role;
grant execute on function public.reverse_financial_movement_controlled(text,uuid,uuid,timestamptz,text) to authenticated,service_role;
grant execute on function public.record_cash_closure_controlled(text,uuid,uuid,numeric,timestamptz,text) to authenticated,service_role;
