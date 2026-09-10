begin;

alter table lihen_private.intelligence_image_transformation_candidates
  drop constraint if exists intelligence_image_transformation_candidates_status_check;

alter table lihen_private.intelligence_image_transformation_candidates
  add constraint intelligence_image_transformation_candidates_status_check
  check (status in ('PENDING_REVIEW','APPROVED','REJECTED'));

alter table lihen_private.intelligence_image_transformation_candidates
  add column if not exists reviewed_by uuid references auth.users(id) on delete restrict,
  add column if not exists review_reason text,
  add column if not exists reviewed_at timestamptz;

create table if not exists lihen_private.intelligence_image_transformation_review_operations (
  operation_key text primary key,
  candidate_id uuid not null references lihen_private.intelligence_image_transformation_candidates(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('APPROVE','REJECT')),
  reason text not null check (length(btrim(reason)) > 0),
  request_fingerprint text not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

revoke all
on table lihen_private.intelligence_image_transformation_review_operations
from public, anon, authenticated;

create or replace function public.review_intelligence_image_transformation_candidate(
  p_operation_key text,
  p_candidate_id uuid,
  p_decision text,
  p_reason text
)
returns table (
  candidate_id uuid,
  status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_candidate lihen_private.intelligence_image_transformation_candidates%rowtype;
  v_existing lihen_private.intelligence_image_transformation_review_operations%rowtype;
  v_new_status text;
  v_fingerprint text;
begin
  if v_actor is null then
    raise exception using errcode='42501',
      message='LIHEN_INTELLIGENCE_REVIEW_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501',
      message='LIHEN_INTELLIGENCE_REVIEW_FORBIDDEN';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) = 0 then
    raise exception using errcode='22023',
      message='LIHEN_INTELLIGENCE_REVIEW_OPERATION_KEY_REQUIRED';
  end if;

  if p_decision not in ('APPROVE','REJECT') then
    raise exception using errcode='22023',
      message='LIHEN_INTELLIGENCE_REVIEW_DECISION_INVALID';
  end if;

  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception using errcode='22023',
      message='LIHEN_INTELLIGENCE_REVIEW_REASON_REQUIRED';
  end if;

  v_fingerprint := md5(concat_ws('|',
    p_candidate_id::text,
    p_decision,
    btrim(p_reason)
  ));

  select *
  into v_existing
  from lihen_private.intelligence_image_transformation_review_operations o
  where o.operation_key = btrim(p_operation_key);

  if found then
    if v_existing.actor_id <> v_actor
       or v_existing.candidate_id <> p_candidate_id
       or v_existing.decision <> p_decision
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception using errcode='23505',
        message='LIHEN_INTELLIGENCE_REVIEW_OPERATION_CONFLICT';
    end if;

    return query
    select
      (v_existing.result_snapshot->>'candidate_id')::uuid,
      v_existing.result_snapshot->>'status',
      (v_existing.result_snapshot->>'reviewed_by')::uuid,
      (v_existing.result_snapshot->>'reviewed_at')::timestamptz,
      true;

    return;
  end if;

  select *
  into v_candidate
  from lihen_private.intelligence_image_transformation_candidates c
  where c.id = p_candidate_id
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='LIHEN_INTELLIGENCE_REVIEW_CANDIDATE_NOT_FOUND';
  end if;

  if v_candidate.status <> 'PENDING_REVIEW' then
    raise exception using errcode='22023',
      message='LIHEN_INTELLIGENCE_REVIEW_CANDIDATE_NOT_PENDING';
  end if;

  v_new_status :=
    case p_decision
      when 'APPROVE' then 'APPROVED'
      else 'REJECTED'
    end;

  update lihen_private.intelligence_image_transformation_candidates
  set
    status = v_new_status,
    reviewed_by = v_actor,
    review_reason = btrim(p_reason),
    reviewed_at = now()
  where id = p_candidate_id
  returning *
  into v_candidate;

  insert into lihen_private.intelligence_image_transformation_review_operations (
    operation_key,
    candidate_id,
    actor_id,
    decision,
    reason,
    request_fingerprint,
    result_snapshot
  )
  values (
    btrim(p_operation_key),
    p_candidate_id,
    v_actor,
    p_decision,
    btrim(p_reason),
    v_fingerprint,
    jsonb_build_object(
      'candidate_id', v_candidate.id,
      'status', v_candidate.status,
      'reviewed_by', v_candidate.reviewed_by,
      'reviewed_at', v_candidate.reviewed_at
    )
  );

  return query
  select
    v_candidate.id,
    v_candidate.status,
    v_candidate.reviewed_by,
    v_candidate.reviewed_at,
    false;
end;
$$;

revoke all
on function public.review_intelligence_image_transformation_candidate(
  text, uuid, text, text
)
from public, anon;

grant execute
on function public.review_intelligence_image_transformation_candidate(
  text, uuid, text, text
)
to authenticated;

commit;
