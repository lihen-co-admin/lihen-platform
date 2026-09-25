-- SOCIAL-05 — Marketing Social Durable Persistence Schema Foundation
--
-- Durable persistence only.
-- This migration does NOT authorize publication, messaging, scheduling
-- execution, external API access, or automatic writes.

create table public.marketing_content_schedules (
  id uuid primary key,
  channel_variant_id uuid not null,
  scheduled_for timestamptz not null,
  timezone text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,

  constraint marketing_content_schedules_timezone_not_blank
    check (length(btrim(timezone)) > 0),

  constraint marketing_content_schedules_status_check
    check (status in (
      'DRAFT',
      'READY_FOR_REVIEW',
      'APPROVED',
      'CANCELLED'
    ))
);

create index marketing_content_schedules_channel_variant_idx
  on public.marketing_content_schedules(channel_variant_id);

create index marketing_content_schedules_scheduled_for_idx
  on public.marketing_content_schedules(scheduled_for);


create table public.marketing_prepared_publications (
  id uuid primary key,
  campaign_id uuid not null,
  campaign_content_id uuid not null,
  channel_variant_id uuid not null,
  schedule_id uuid null
    references public.marketing_content_schedules(id)
    on delete set null,
  channel text not null,
  copy text not null,
  cta text null,
  hashtags text[] not null default '{}',
  creative_asset_ids uuid[] not null default '{}',
  status text not null,
  prepared_at timestamptz not null,

  constraint marketing_prepared_publications_status_check
    check (status in (
      'PREPARED',
      'IN_REVIEW',
      'APPROVED',
      'CANCELLED'
    ))
);

create index marketing_prepared_publications_channel_variant_idx
  on public.marketing_prepared_publications(channel_variant_id);

create index marketing_prepared_publications_schedule_idx
  on public.marketing_prepared_publications(schedule_id);


create table public.marketing_publication_attempts (
  id uuid primary key,
  prepared_publication_id uuid not null
    references public.marketing_prepared_publications(id)
    on delete restrict,
  attempt_number integer not null,
  status text not null,
  started_at timestamptz null,
  completed_at timestamptz null,
  external_publication_ref text null,
  failure_code text null,

  constraint marketing_publication_attempts_attempt_number_check
    check (attempt_number > 0),

  constraint marketing_publication_attempts_status_check
    check (status in (
      'PENDING',
      'IN_PROGRESS',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED'
    )),

  constraint marketing_publication_attempts_entity_attempt_unique
    unique (prepared_publication_id, attempt_number)
);

create index marketing_publication_attempts_prepared_publication_idx
  on public.marketing_publication_attempts(prepared_publication_id);


alter table public.marketing_content_schedules
  enable row level security;

alter table public.marketing_prepared_publications
  enable row level security;

alter table public.marketing_publication_attempts
  enable row level security;


comment on table public.marketing_content_schedules is
  'Durable Marketing social content scheduling state. APPROVED does not authorize publication.';

comment on table public.marketing_prepared_publications is
  'Prepared Marketing social publication state. APPROVED does not mean PUBLISHED and does not authorize external publication.';

comment on table public.marketing_publication_attempts is
  'Publication-attempt persistence contract only. SOCIAL-05 provides no execution mechanism.';
