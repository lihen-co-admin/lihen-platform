-- GAP-041 corrective migration 2
-- Resolve PL/pgSQL ambiguity between the RETURNS TABLE output column `intent_id`
-- and the expiry UPDATE predicate/RETURNING path.
-- No policy or execution semantics change.

create or replace function public.prepare_control_center_operation_controlled(
  p_operation_key text,
  p_operation_code text,
  p_request_payload jsonb
)
returns table(
  intent_id uuid,
  operation_key text,
  operation_code text,
  domain_code text,
  risk_level text,
  action_kind text,
  requires_confirmation boolean,
  execution_enabled boolean,
  status text,
  confirmation_token uuid,
  preview_snapshot jsonb,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_catalog lihen_private.control_center_operation_catalog%rowtype;
  v_fingerprint text;
  v_intent lihen_private.control_center_operation_intents%rowtype;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists(
    select 1
    from public.profiles p
    where p.id=v_actor
      and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_OPERATION_PREVIEW_FORBIDDEN';
  end if;

  if nullif(btrim(p_operation_key),'') is null then
    raise exception using errcode='22023', message='LIHEN_OPERATION_KEY_REQUIRED';
  end if;

  select *
  into v_catalog
  from lihen_private.control_center_operation_catalog c
  where c.operation_code=p_operation_code;

  if not found then
    raise exception using errcode='22023', message='LIHEN_OPERATION_CODE_UNKNOWN';
  end if;

  v_fingerprint := md5(coalesce(p_request_payload,'{}'::jsonb)::text);

  insert into lihen_private.control_center_operation_intents(
    operation_key,
    operation_code,
    actor_id,
    request_payload,
    request_fingerprint,
    preview_snapshot
  )
  values (
    p_operation_key,
    p_operation_code,
    v_actor,
    coalesce(p_request_payload,'{}'::jsonb),
    v_fingerprint,
    jsonb_build_object(
      'operation_code', v_catalog.operation_code,
      'domain_code', v_catalog.domain_code,
      'risk_level', v_catalog.risk_level,
      'action_kind', v_catalog.action_kind,
      'requires_confirmation', v_catalog.requires_confirmation,
      'execution_enabled', false,
      'execution_note', 'PREVIEW_ONLY_NO_BUSINESS_MUTATION'
    )
  )
  on conflict on constraint control_center_operation_intents_operation_key_key do nothing
  returning * into v_intent;

  if v_intent.intent_id is null then
    select *
    into v_intent
    from lihen_private.control_center_operation_intents i
    where i.operation_key=p_operation_key;

    if not found then
      raise exception using errcode='P0002', message='LIHEN_OPERATION_IDEMPOTENCY_CLAIM_NOT_FOUND';
    end if;

    if v_intent.actor_id <> v_actor then
      raise exception using errcode='42501', message='LIHEN_OPERATION_KEY_OWNERSHIP_MISMATCH';
    end if;

    if v_intent.operation_code <> p_operation_code
       or v_intent.request_fingerprint <> v_fingerprint then
      raise exception using errcode='23505', message='LIHEN_OPERATION_KEY_REUSE_MISMATCH';
    end if;

    if v_intent.status='PREVIEWED' and v_intent.expires_at <= now() then
      update lihen_private.control_center_operation_intents as i
      set status='EXPIRED', updated_at=now()
      where i.intent_id=v_intent.intent_id
      returning i.* into v_intent;
    end if;
  end if;

  return query
  select
    v_intent.intent_id,
    v_intent.operation_key,
    v_intent.operation_code,
    v_catalog.domain_code,
    v_catalog.risk_level,
    v_catalog.action_kind,
    v_catalog.requires_confirmation,
    false,
    v_intent.status,
    v_intent.confirmation_token,
    v_intent.preview_snapshot,
    v_intent.expires_at;
end;
$$;

revoke all on function public.prepare_control_center_operation_controlled(text,text,jsonb)
  from public, anon;

grant execute on function public.prepare_control_center_operation_controlled(text,text,jsonb)
  to authenticated, postgres;

comment on function public.prepare_control_center_operation_controlled(text,text,jsonb) is
'GAP-041 atomic idempotency hardening. Preserves Phase 8.5 actor ownership, expiry and preview-only semantics; resolves PL/pgSQL output-column ambiguity for conflict and expiry paths.';
