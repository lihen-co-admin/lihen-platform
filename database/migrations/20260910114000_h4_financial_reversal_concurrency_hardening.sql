-- H4 — Financial reversal concurrency hardening.
-- Guarantees:
-- 1) one reversal per original financial movement at database level;
-- 2) concurrent reversal attempts serialize on the original movement row;
-- 3) existing authorization, idempotency and domain restrictions are preserved.

create unique index if not exists financial_movements_one_reversal_per_original_uidx
  on public.financial_movements(reversal_of_id)
  where reversal_of_id is not null;

create or replace function public.reverse_financial_movement_controlled(
  p_operation_key text,
  p_reversal_movement_id uuid,
  p_original_movement_id uuid,
  p_occurred_at timestamptz,
  p_reason text
)
returns table(
  reversal_movement_id uuid,
  original_movement_id uuid,
  account_id uuid,
  amount_signed numeric,
  balance numeric
)
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_fp text;
  v_existing lihen_private.financial_write_operations%rowtype;
  v_original public.financial_movements%rowtype;
  v_balance numeric;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists(
    select 1
    from public.profiles p
    where p.id=v_actor
      and p.authorization_status='ACTIVE'
      and p.role_code in('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_FINANCE_FORBIDDEN';
  end if;

  if p_operation_key is null
     or btrim(p_operation_key)=''
     or p_reversal_movement_id is null
     or p_original_movement_id is null
     or p_reason is null
     or btrim(p_reason)='' then
    raise exception using errcode='22023', message='LIHEN_REVERSAL_FIELDS_REQUIRED';
  end if;

  v_fp := md5(concat_ws(
    '|',
    p_reversal_movement_id::text,
    p_original_movement_id::text,
    coalesce(p_occurred_at::text,'<NOW>'),
    btrim(p_reason)
  ));

  select *
    into v_existing
  from lihen_private.financial_write_operations
  where operation_key=btrim(p_operation_key);

  if found then
    if v_existing.operation_type<>'REVERSAL'
       or v_existing.actor_id<>v_actor
       or v_existing.movement_id<>p_reversal_movement_id
       or v_existing.request_fingerprint is distinct from v_fp then
      raise exception using errcode='23505', message='LIHEN_FINANCIAL_OPERATION_CONFLICT';
    end if;

    select b.balance
      into v_balance
    from public.financial_account_balances b
    where b.account_id=v_existing.account_id;

    return query
    select
      m.id,
      p_original_movement_id,
      m.account_id,
      m.amount_signed,
      v_balance
    from public.financial_movements m
    where m.id=v_existing.movement_id;

    return;
  end if;

  select *
    into v_original
  from public.financial_movements
  where id=p_original_movement_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='LIHEN_FINANCIAL_MOVEMENT_NOT_FOUND';
  end if;

  if v_original.movement_type not in('EXPENSE','ADJUSTMENT') then
    raise exception using errcode='22023', message='LIHEN_REVERSAL_REQUIRES_DOMAIN_WORKFLOW';
  end if;

  if exists(
    select 1
    from public.financial_movements m
    where m.reversal_of_id=p_original_movement_id
  ) then
    raise exception using errcode='23505', message='LIHEN_FINANCIAL_MOVEMENT_ALREADY_REVERSED';
  end if;

  insert into public.financial_movements(
    id,
    account_id,
    movement_type,
    amount_signed,
    occurred_at,
    description,
    reference_type,
    reference_id,
    reversal_of_id
  )
  values(
    p_reversal_movement_id,
    v_original.account_id,
    'REVERSAL',
    -v_original.amount_signed,
    coalesce(p_occurred_at,now()),
    'Reversión: '||btrim(p_reason),
    'FINANCIAL_MOVEMENT',
    p_original_movement_id,
    p_original_movement_id
  );

  insert into lihen_private.financial_write_operations(
    operation_key,
    operation_type,
    actor_id,
    account_id,
    movement_id,
    request_fingerprint,
    result_snapshot
  )
  values(
    btrim(p_operation_key),
    'REVERSAL',
    v_actor,
    v_original.account_id,
    p_reversal_movement_id,
    v_fp,
    jsonb_build_object('original_movement_id',p_original_movement_id)
  );

  select b.balance
    into v_balance
  from public.financial_account_balances b
  where b.account_id=v_original.account_id;

  return query
  select
    p_reversal_movement_id,
    p_original_movement_id,
    v_original.account_id,
    -v_original.amount_signed,
    v_balance;
end;
$fn$;

revoke all on function public.reverse_financial_movement_controlled(
  text,uuid,uuid,timestamptz,text
) from public,anon;

grant execute on function public.reverse_financial_movement_controlled(
  text,uuid,uuid,timestamptz,text
) to authenticated,service_role;
