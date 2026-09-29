-- TIKTOK-01: additive evidence only. No provider calls, credentials or activation.
alter table public.marketing_publication_attempts
  add column provider_evidence jsonb not null default '[]'::jsonb
  check (jsonb_typeof(provider_evidence) = 'array');

create function public.append_marketing_tiktok_evidence_server_controlled(
  p_actor_id uuid, p_attempt_id uuid, p_evidence jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.marketing_publication_attempts%rowtype;
  v_channel text;
  v_publish_id text;
begin
  if p_actor_id is null or not exists (
    select 1 from public.profiles p where p.id = p_actor_id
      and p.authorization_status = 'ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception 'LIHEN_TIKTOK_EVIDENCE_FORBIDDEN' using errcode = '42501';
  end if;
  if p_evidence is null or jsonb_typeof(p_evidence) <> 'object'
    or coalesce(p_evidence->>'kind','') not in ('CONSENT','ACCEPTED','PROCESSING','UNKNOWN','COMPLETE','FAILED')
    or octet_length(p_evidence::text) > 16384
    or exists (select 1 from jsonb_object_keys(p_evidence) k where k not in
      ('kind','publishId','accountId','creatorRevision','privacy','consent','consentText','publicationRef','code','interactions'))
  then raise exception 'LIHEN_TIKTOK_EVIDENCE_INVALID'; end if;
  if p_evidence->>'kind' = 'CONSENT' and (
    p_evidence->'consent' is distinct from 'true'::jsonb
    or nullif(btrim(p_evidence->>'accountId'),'') is null
    or nullif(btrim(p_evidence->>'creatorRevision'),'') is null
    or nullif(btrim(p_evidence->>'privacy'),'') is null
    or nullif(btrim(p_evidence->>'consentText'),'') is null
  ) then raise exception 'LIHEN_TIKTOK_CONSENT_REQUIRED'; end if;
  if p_evidence->>'kind' = 'COMPLETE'
    and nullif(btrim(p_evidence->>'publicationRef'),'') is null
  then raise exception 'LIHEN_TIKTOK_FINAL_REFERENCE_REQUIRED'; end if;
  if p_evidence->>'kind' = 'FAILED'
    and nullif(btrim(p_evidence->>'code'),'') is null
  then raise exception 'LIHEN_TIKTOK_FAILURE_CODE_REQUIRED'; end if;

  select * into v_attempt from public.marketing_publication_attempts
    where id = p_attempt_id for update;
  if not found or v_attempt.status <> 'IN_PROGRESS' then
    raise exception 'LIHEN_TIKTOK_ATTEMPT_NOT_IN_PROGRESS';
  end if;
  select channel into v_channel from public.marketing_prepared_publications
    where id = v_attempt.prepared_publication_id;
  if v_channel is distinct from 'TIKTOK' then raise exception 'LIHEN_TIKTOK_CHANNEL_REQUIRED'; end if;
  select e->>'publishId' into v_publish_id
    from jsonb_array_elements(v_attempt.provider_evidence) e
    where nullif(btrim(e->>'publishId'),'') is not null limit 1;
  if v_publish_id is not null and p_evidence ? 'publishId'
    and v_publish_id is distinct from p_evidence->>'publishId'
  then raise exception 'LIHEN_TIKTOK_PUBLISH_ID_CONFLICT'; end if;
  if p_evidence->>'kind' in ('ACCEPTED','PROCESSING','COMPLETE','FAILED')
    and nullif(btrim(p_evidence->>'publishId'),'') is null
  then raise exception 'LIHEN_TIKTOK_PUBLISH_ID_REQUIRED'; end if;
  if jsonb_array_length(v_attempt.provider_evidence) >= 32 then
    raise exception 'LIHEN_TIKTOK_EVIDENCE_LIMIT';
  end if;
  update public.marketing_publication_attempts
    set provider_evidence = provider_evidence || jsonb_build_array(
      p_evidence || jsonb_build_object('recordedAt', now(), 'actorId', p_actor_id))
    where id = p_attempt_id;
end;
$$;

revoke all on function public.append_marketing_tiktok_evidence_server_controlled(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.append_marketing_tiktok_evidence_server_controlled(uuid, uuid, jsonb)
  to service_role;
comment on function public.append_marketing_tiktok_evidence_server_controlled(uuid, uuid, jsonb)
is 'Append TikTok consent and provider evidence to a governed IN_PROGRESS attempt; never initializes, retries or completes publication.';
