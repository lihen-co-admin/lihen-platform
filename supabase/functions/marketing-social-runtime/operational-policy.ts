// Shared by preflight and the existing runtime actions. Never calls a provider.
export interface OperationalSnapshot {
  publication: {
    id: string;
    channel: string;
    status: string;
    schedule_id: string | null;
    channel_variant_id: string;
    creative_asset_ids: string[];
    copy: string;
    cta: string | null;
    hashtags: string[];
    [key: string]: unknown;
  };
  schedule: {
    id: string;
    channel_variant_id: string;
    status: string;
    scheduled_for: string;
    [key: string]: unknown;
  } | null;
  attempts: { id: string; status: string; [key: string]: unknown }[];
}

export function assessOperationalSnapshot(
  snapshot: OperationalSnapshot,
  now: number,
  tiktokBlockers: readonly string[] = ['TIKTOK_PROVIDER_CONTRACT_UNVERIFIED'],
) {
  const { publication: publication, schedule, attempts } = snapshot;
  const blockers: string[] = [];
  if (publication.channel === 'TIKTOK') {
    blockers.push(...tiktokBlockers);
    if (publication.creative_asset_ids.length !== 1) blockers.push('TIKTOK_SINGLE_VIDEO_REQUIRED');
  } else if (
    !['FACEBOOK', 'INSTAGRAM_FEED', 'INSTAGRAM_STORY', 'INSTAGRAM_REEL'].includes(
      publication.channel,
    )
  )
    blockers.push('CHANNEL_UNAVAILABLE');
  if (publication.status !== 'APPROVED') blockers.push('PUBLICATION_NOT_APPROVED');
  if (
    !schedule ||
    schedule.id !== publication.schedule_id ||
    schedule.channel_variant_id !== publication.channel_variant_id
  )
    blockers.push('SCHEDULE_LINK_INVALID');
  if (schedule?.status !== 'APPROVED') blockers.push('SCHEDULE_NOT_APPROVED');
  const due = Date.parse(schedule?.scheduled_for ?? '');
  if (!Number.isFinite(due) || !Number.isFinite(now) || due > now) blockers.push('NOT_DUE');
  if (!publication.creative_asset_ids[0]?.trim()) blockers.push('MEDIA_REQUIRED');
  if (attempts.length && (attempts.length !== 1 || attempts[0]?.status !== 'PENDING'))
    blockers.push('ATTEMPT_REQUIRES_RECONCILIATION_NO_RETRY');
  return {
    blockers,
    nextAction: blockers.length
      ? null
      : attempts.length
        ? ('EXECUTE_PUBLICATION_ATTEMPT' as const)
        : ('CREATE_PUBLICATION_ATTEMPT' as const),
    attemptId: attempts.length === 1 ? attempts[0]!.id : null,
  };
}

export function requireOperationalConfirmation(
  payload: Record<string, unknown>,
  assessment: { snapshot: string; nextAction: string | null },
  action: string,
) {
  if (
    payload.confirmedAction !== action ||
    !assessment.nextAction ||
    assessment.nextAction !== action ||
    payload.expectedSnapshot !== assessment.snapshot
  )
    throw new Error('LIHEN_MARKETING_SOCIAL_FRESH_ASSESSMENT_AND_CONFIRMATION_REQUIRED');
}
