-- FASE 2.8A: canonical operational finance foundation.
-- Legacy balances are intentionally NOT imported here.
create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  account_type text not null check (account_type in ('CASH','DIGITAL_WALLET','BANK','OTHER')),
  currency text not null default 'COP' check (currency = 'COP'),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  movement_type text not null check (movement_type in ('SALE_INCOME','EXPENSE','TRANSFER_IN','TRANSFER_OUT','ADJUSTMENT','REVERSAL')),
  amount_signed numeric(14,2) not null check (amount_signed <> 0),
  currency text not null default 'COP' check (currency='COP'),
  occurred_at timestamptz not null,
  description text not null check (length(btrim(description)) > 0),
  reference_type text null,
  reference_id uuid null,
  reversal_of_id uuid null references public.financial_movements(id) on delete restrict,
  created_at timestamptz not null default now()
);
create or replace view public.financial_account_balances as
select a.id as account_id,a.code,a.name,a.account_type,a.currency,a.status,
       coalesce(sum(m.amount_signed),0::numeric) as balance
from public.financial_accounts a left join public.financial_movements m on m.account_id=a.id
group by a.id,a.code,a.name,a.account_type,a.currency,a.status;
create table if not exists lihen_private.financial_write_operations (
  operation_key text primary key,operation_type text not null,actor_id uuid not null,
  account_id uuid null,movement_id uuid null,request_fingerprint text not null,
  result_snapshot jsonb null,created_at timestamptz not null default now()
);
alter table public.financial_accounts enable row level security;
alter table public.financial_movements enable row level security;
drop policy if exists financial_accounts_admin_read on public.financial_accounts;
create policy financial_accounts_admin_read on public.financial_accounts for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN'))
);
drop policy if exists financial_movements_admin_read on public.financial_movements;
create policy financial_movements_admin_read on public.financial_movements for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN'))
);
revoke all on public.financial_accounts from anon,authenticated;
revoke all on public.financial_movements from anon,authenticated;
revoke all on public.financial_account_balances from anon,authenticated;
grant select on public.financial_accounts,public.financial_movements,public.financial_account_balances to authenticated;
create or replace function public.create_financial_account_controlled(
  p_operation_key text,p_id uuid,p_code text,p_name text,p_account_type text,p_currency text default 'COP'
) returns table(id uuid,code text,name text,account_type text,currency text,status text,balance numeric)
language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=auth.uid(); v_fp text; v_existing lihen_private.financial_write_operations%rowtype; v_row public.financial_accounts%rowtype;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_FINANCE_FORBIDDEN'; end if;
  if p_operation_key is null or btrim(p_operation_key)='' then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_id is null then raise exception using errcode='22023',message='LIHEN_ACCOUNT_ID_REQUIRED'; end if;
  if p_code is null or btrim(p_code)='' or p_name is null or btrim(p_name)='' then raise exception using errcode='22023',message='LIHEN_ACCOUNT_FIELDS_REQUIRED'; end if;
  if p_account_type not in('CASH','DIGITAL_WALLET','BANK','OTHER') then raise exception using errcode='22023',message='LIHEN_ACCOUNT_TYPE_INVALID'; end if;
  if coalesce(p_currency,'COP')<>'COP' then raise exception using errcode='22023',message='LIHEN_CURRENCY_INVALID'; end if;
  v_fp:=md5(concat_ws('|',p_id::text,btrim(p_code),btrim(p_name),p_account_type,coalesce(p_currency,'COP')));
  select * into v_existing from lihen_private.financial_write_operations where operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'CREATE_ACCOUNT' or v_existing.actor_id<>v_actor or v_existing.request_fingerprint is distinct from v_fp then raise exception using errcode='23505',message='LIHEN_FINANCIAL_OPERATION_CONFLICT'; end if;
    return query select a.id,a.code,a.name,a.account_type,a.currency,a.status,b.balance from public.financial_accounts a join public.financial_account_balances b on b.account_id=a.id where a.id=v_existing.account_id; return;
  end if;
  insert into public.financial_accounts(id,code,name,account_type,currency) values(p_id,btrim(p_code),btrim(p_name),p_account_type,coalesce(p_currency,'COP')) returning * into v_row;
  insert into lihen_private.financial_write_operations(operation_key,operation_type,actor_id,account_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'CREATE_ACCOUNT',v_actor,v_row.id,v_fp,jsonb_build_object('id',v_row.id,'code',v_row.code));
  return query select a.id,a.code,a.name,a.account_type,a.currency,a.status,b.balance from public.financial_accounts a join public.financial_account_balances b on b.account_id=a.id where a.id=v_row.id;
end;$fn$;
revoke all on function public.create_financial_account_controlled(text,uuid,text,text,text,text) from public,anon;
grant execute on function public.create_financial_account_controlled(text,uuid,text,text,text,text) to authenticated,service_role;
