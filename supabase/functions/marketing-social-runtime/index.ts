import { createClient } from 'supabase';
import {
  assessOperationalSnapshot,
  requireOperationalConfirmation,
  type OperationalSnapshot,
} from './operational-policy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Action =
  | 'ASSESS_PUBLICATION_OPERATION'
  | 'READ_EDITORIAL_WORKSPACE'
  | 'SAVE_CONTENT_SCHEDULE'
  | 'SAVE_PREPARED_PUBLICATION'
  | 'CREATE_PUBLICATION_ATTEMPT'
  | 'EXECUTE_PUBLICATION_ATTEMPT';

interface RuntimeRequest {
  action?: Action;
  payload?: Record<string, unknown>;
}

interface PreparedPublicationRow {
  readonly id: string;
  readonly channel: string;
  readonly copy: string;
  readonly cta: string | null;
  readonly hashtags: string[] | null;
  readonly creative_asset_ids: string[] | null;
  readonly status: string;
}

interface ProductImageRpcRow {
  readonly id: unknown;
  readonly product_id: unknown;
  readonly public_url: unknown;
  readonly status: unknown;
}

interface EditorialVideoRpcRow {
  readonly id: unknown;
  readonly product_id: unknown;
  readonly public_url: unknown;
  readonly mime_type: unknown;
  readonly status: unknown;
}

interface AuthorizedMedia {
  readonly publicUrl: string;
  readonly mediaType: 'IMAGE' | 'VIDEO';
}

interface MetaGraphResponse {
  readonly id?: string;
  readonly error?: { readonly code?: number; readonly message?: string };
}

function metaPublicationEnabled(): boolean {
  return Deno.env.get('META_PUBLICATION_ENABLED')?.trim().toLowerCase() === 'true';
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`LIHEN_MARKETING_SOCIAL_${name}_NOT_CONFIGURED`);
  return value;
}

function publicationCaption(publication: PreparedPublicationRow): string {
  return [
    publication.copy.trim(),
    publication.cta?.trim() ?? '',
    (publication.hashtags ?? []).map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' '),
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function resolveAuthorizedProductImageUrl(
  client: {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  },
  productId: string,
  productImageId: string,
): Promise<string> {
  const result = await client.rpc('get_product_images', { p_product_id: productId });
  if (result.error) {
    throw new Error(`LIHEN_PRODUCT_IMAGE_RESOLUTION_FAILED:${result.error.message ?? 'UNKNOWN'}`);
  }

  const rows = Array.isArray(result.data) ? (result.data as ProductImageRpcRow[]) : [];
  const row = rows.find(
    (candidate) =>
      String(candidate.id) === productImageId &&
      String(candidate.product_id) === productId &&
      String(candidate.status) === 'ACTIVE',
  );
  if (!row) throw new Error('LIHEN_PRODUCT_IMAGE_NOT_AUTHORIZED_OR_NOT_FOUND');

  const publicUrl = String(row.public_url ?? '').trim();
  if (!publicUrl) throw new Error('LIHEN_PRODUCT_IMAGE_SOURCE_UNAVAILABLE');
  return publicUrl;
}

async function resolveAuthorizedPublicationMedia(
  client: {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  },
  publication: PreparedPublicationRow,
  productId: string,
): Promise<AuthorizedMedia> {
  const assetId = publication.creative_asset_ids?.[0]?.trim();
  if (!assetId) throw new Error('LIHEN_MARKETING_SOCIAL_MEDIA_REQUIRED');

  if (publication.channel !== 'INSTAGRAM_REEL') {
    return {
      publicUrl: await resolveAuthorizedProductImageUrl(client, productId, assetId),
      mediaType: 'IMAGE',
    };
  }

  const result = await client.rpc('get_marketing_editorial_video_assets', { p_product_id: productId });
  if (result.error)
    throw new Error(`LIHEN_EDITORIAL_VIDEO_RESOLUTION_FAILED:${result.error.message ?? 'UNKNOWN'}`);
  const rows = Array.isArray(result.data) ? (result.data as EditorialVideoRpcRow[]) : [];
  const row = rows.find(
    (candidate) =>
      String(candidate.id) === assetId &&
      String(candidate.product_id) === productId &&
      String(candidate.status) === 'ACTIVE',
  );
  if (!row) throw new Error('LIHEN_EDITORIAL_VIDEO_NOT_AUTHORIZED_OR_NOT_FOUND');
  if (!String(row.mime_type ?? '').startsWith('video/'))
    throw new Error('LIHEN_EDITORIAL_REEL_VIDEO_REQUIRED');
  const publicUrl = String(row.public_url ?? '').trim();
  if (!publicUrl) throw new Error('LIHEN_EDITORIAL_VIDEO_SOURCE_UNAVAILABLE');
  return { publicUrl, mediaType: 'VIDEO' };
}

async function publishMetaMedia(
  publication: PreparedPublicationRow,
  media: AuthorizedMedia,
): Promise<
  | { outcome: 'SUCCEEDED'; externalPublicationRef: string }
  | { outcome: 'FAILED'; failureCode: string }
> {
  const accessToken =
    publication.channel === 'FACEBOOK'
      ? requiredEnv('META_FACEBOOK_ACCESS_TOKEN')
      : requiredEnv('META_INSTAGRAM_ACCESS_TOKEN');
  const graphApiVersion = requiredEnv('META_GRAPH_API_VERSION');
  const publicUrl = media.publicUrl;
  const caption = publicationCaption(publication);

  const post = async (path: string, body: Record<string, string>): Promise<MetaGraphResponse> => {
    const graphHost =
      publication.channel === 'FACEBOOK' ? 'graph.facebook.com' : 'graph.instagram.com';

    const url = new URL(`https://${graphHost}/${graphApiVersion}/${path}`);
    const params = new URLSearchParams(body);
    params.set('access_token', accessToken);
    const response = await fetch(url, { method: 'POST', body: params });
    return (await response.json()) as MetaGraphResponse;
  };

  if (publication.channel === 'FACEBOOK') {
    const pageId = requiredEnv('META_FACEBOOK_PAGE_ID');
    const result = await post(`${pageId}/photos`, { url: publicUrl, caption });
    return result.id
      ? { outcome: 'SUCCEEDED', externalPublicationRef: result.id }
      : {
          outcome: 'FAILED',
          failureCode: result.error?.code ? `META_${result.error.code}` : 'META_PUBLICATION_FAILED',
        };
  }

  if (['INSTAGRAM_FEED', 'INSTAGRAM_STORY', 'INSTAGRAM_REEL'].includes(publication.channel)) {
    const instagramAccountId = requiredEnv('META_INSTAGRAM_ACCOUNT_ID');
    const container =
      publication.channel === 'INSTAGRAM_REEL'
        ? media.mediaType === 'VIDEO'
          ? { media_type: 'REELS', video_url: publicUrl, caption }
          : null
        : publication.channel === 'INSTAGRAM_STORY'
          ? { media_type: 'STORIES', image_url: publicUrl }
          : { image_url: publicUrl, caption };
    if (!container) return { outcome: 'FAILED', failureCode: 'META_REEL_VIDEO_REQUIRED' };
    const created = await post(`${instagramAccountId}/media`, container);
    if (!created.id) {
      return {
        outcome: 'FAILED',
        failureCode: created.error?.code
          ? `META_${created.error.code}`
          : 'META_CONTAINER_CREATE_FAILED',
      };
    }
    const getContainerStatus = async (): Promise<string | null> => {
      const url = new URL(`https://graph.instagram.com/${graphApiVersion}/${created.id}`);
      url.searchParams.set('fields', 'status_code');
      url.searchParams.set('access_token', accessToken);

      const response = await fetch(url);
      const data = (await response.json()) as {
        status_code?: string;
        error?: { code?: number };
      };

      if (data.error?.code) {
        return `META_${data.error.code}`;
      }

      return data.status_code ?? null;
    };

    let containerStatus: string | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      containerStatus = await getContainerStatus();

      if (containerStatus === 'FINISHED') break;

      if (
        containerStatus === 'ERROR' ||
        containerStatus === 'EXPIRED' ||
        containerStatus?.startsWith('META_')
      ) {
        return {
          outcome: 'FAILED',
          failureCode:
            containerStatus === 'ERROR'
              ? 'META_CONTAINER_PROCESSING_ERROR'
              : containerStatus === 'EXPIRED'
                ? 'META_CONTAINER_EXPIRED'
                : containerStatus,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (containerStatus !== 'FINISHED') {
      return {
        outcome: 'FAILED',
        failureCode: 'META_CONTAINER_PROCESSING_TIMEOUT',
      };
    }

    const published = await post(`${instagramAccountId}/media_publish`, {
      creation_id: created.id,
    });

    return published.id
      ? { outcome: 'SUCCEEDED', externalPublicationRef: published.id }
      : {
          outcome: 'FAILED',
          failureCode: published.error?.code
            ? `META_${published.error.code}`
            : 'META_MEDIA_PUBLISH_FAILED',
        };
  }

  return { outcome: 'FAILED', failureCode: 'META_CHANNEL_UNSUPPORTED' };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function publishableKey(): string {
  const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');

  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }

  const legacy = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacy) return legacy;

  throw new Error('SUPABASE_PUBLISHABLE_KEY_NOT_CONFIGURED');
}

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`LIHEN_MARKETING_SOCIAL_PAYLOAD_${key.toUpperCase()}_REQUIRED`);
  }

  return value;
}

function nullableString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];

  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`LIHEN_MARKETING_SOCIAL_PAYLOAD_${key.toUpperCase()}_INVALID`);
  }

  return value;
}

function stringArray(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];

  if (value === undefined || value === null) return [];

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`LIHEN_MARKETING_SOCIAL_PAYLOAD_${key.toUpperCase()}_INVALID`);
  }

  return value as string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const authorization = req.headers.get('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return json({ error: 'LIHEN_AUTH_REQUIRED' }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

    const userSupabase = createClient(supabaseUrl, publishableKey(), {
      global: {
        headers: { Authorization: authorization },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED');
    }

    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const token = authorization.slice('Bearer '.length);

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'LIHEN_AUTH_INVALID' }, 401);
    }

    const { data: profile, error: profileError } = await userSupabase
      .from('profiles')
      .select('id,role_code,authorization_status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('MARKETING_SOCIAL_PROFILE_LOOKUP_FAILED', profileError);
      return json({ error: 'LIHEN_AUTHORIZATION_LOOKUP_FAILED' }, 500);
    }

    if (
      !profile ||
      profile.authorization_status !== 'ACTIVE' ||
      !['OWNER', 'ADMIN'].includes(profile.role_code)
    ) {
      return json({ error: 'LIHEN_MARKETING_SOCIAL_FORBIDDEN' }, 403);
    }

    const body = (await req.json()) as RuntimeRequest;
    const action = body.action;
    const payload = body.payload;

    if (!action || !payload || typeof payload !== 'object') {
      return json({ error: 'LIHEN_MARKETING_SOCIAL_REQUEST_INVALID' }, 400);
    }

    const operational = [
      'ASSESS_PUBLICATION_OPERATION',
      'CREATE_PUBLICATION_ATTEMPT',
      'EXECUTE_PUBLICATION_ATTEMPT',
    ].includes(action);
    if (operational && Deno.env.get('MARKETING_SOCIAL_ENVIRONMENT') !== 'DEV') {
      return json(
        { error: 'LIHEN_MARKETING_SOCIAL_DEV_REQUIRED', externalPublication: false },
        409,
      );
    }
    const readOperationalState = async () => {
      const publicationId = requiredString(payload, 'preparedPublicationId');
      const publicationResult = await serviceSupabase
        .from('marketing_prepared_publications')
        .select(
          'id,campaign_id,campaign_content_id,channel_variant_id,schedule_id,channel,copy,cta,hashtags,creative_asset_ids,status,prepared_at',
        )
        .eq('id', publicationId)
        .single();
      if (publicationResult.error || !publicationResult.data)
        throw new Error('LIHEN_MARKETING_SOCIAL_PUBLICATION_READ_FAILED');
      const publication = publicationResult.data;
      const scheduleResult = publication.schedule_id
        ? await serviceSupabase
            .from('marketing_content_schedules')
            .select('id,channel_variant_id,scheduled_for,timezone,status,created_at,updated_at')
            .eq('id', publication.schedule_id)
            .single()
        : { data: null, error: null };
      // Scope reconciliation to this publication, independently of workspace limits.
      const attemptsResult = await serviceSupabase
        .from('marketing_publication_attempts')
        .select(
          'id,prepared_publication_id,attempt_number,status,started_at,completed_at,external_publication_ref,failure_code',
        )
        .eq('prepared_publication_id', publicationId)
        .order('attempt_number', { ascending: false })
        .limit(1000);
      if (scheduleResult.error || attemptsResult.error)
        throw new Error('LIHEN_MARKETING_SOCIAL_OPERATION_READ_FAILED');
      if (attemptsResult.data?.length === 1000)
        throw new Error('LIHEN_MARKETING_SOCIAL_ATTEMPT_HISTORY_TRUNCATED');
      const state = {
        publication,
        schedule: scheduleResult.data,
        attempts: attemptsResult.data ?? [],
      } as OperationalSnapshot;
      return state;
    };
    const assess = async () => {
      const state = await readOperationalState();
      const publication = state.publication;
      const publicationId = publication.id;
      const policy = assessOperationalSnapshot(state, Date.now());
      const blockers = [...policy.blockers];
      let media: AuthorizedMedia | null = null;
      try {
        media = await resolveAuthorizedPublicationMedia(
          userSupabase,
          publication,
          requiredString(payload, 'productId'),
        );
      } catch {
        blockers.push(
          publication.channel === 'INSTAGRAM_REEL'
            ? 'REEL_VIDEO_NOT_AUTHORIZED'
            : 'PRODUCT_MEDIA_NOT_AUTHORIZED',
        );
      }
      if (policy.nextAction === 'EXECUTE_PUBLICATION_ATTEMPT') {
        if (!metaPublicationEnabled()) blockers.push('META_PUBLICATION_DISABLED');
        const settings =
          publication.channel === 'FACEBOOK'
            ? ['META_GRAPH_API_VERSION', 'META_FACEBOOK_ACCESS_TOKEN', 'META_FACEBOOK_PAGE_ID']
            : [
                'META_GRAPH_API_VERSION',
                'META_INSTAGRAM_ACCESS_TOKEN',
                'META_INSTAGRAM_ACCOUNT_ID',
              ];
        if (settings.some((name) => !Deno.env.get(name)?.trim()))
          blockers.push('PROVIDER_NOT_CONFIGURED');
      }
      const bytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(
          JSON.stringify({ state, productId: payload.productId, media }),
        ),
      );
      const snapshot = Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      return {
        snapshot,
        blockers,
        nextAction: blockers.length ? null : policy.nextAction,
        attemptId: policy.attemptId,
        preparedPublicationId: publicationId,
        productId: payload.productId,
        channel: publication.channel,
        copy: publication.copy,
        callToAction: publication.cta ?? '',
        hashtags: publication.hashtags ?? [],
        creativeAssetIds: publication.creative_asset_ids ?? [],
        publication,
        assessedAt: new Date().toISOString(),
        executionAllowed: false,
      };
    };

    let data: unknown;
    let error: { message?: string } | null = null;

    if (action === 'READ_EDITORIAL_WORKSPACE') {
      if (payload.preparedPublicationId) {
        const state = await readOperationalState();
        return json({
          data: {
            publications: [state.publication],
            schedules: state.schedule ? [state.schedule] : [],
            attempts: state.attempts,
          },
          externalPublication: false,
        });
      }
      // Controlled, read-only workspace view. The request has already passed
      // bearer-token validation and the active OWNER/ADMIN profile check above.
      // Keep the tables private under RLS; only return the three existing
      // editorial contracts needed by the authenticated Control Center.
      const [schedules, publications, attempts] = await Promise.all([
        serviceSupabase
          .from('marketing_content_schedules')
          .select('id,channel_variant_id,scheduled_for,timezone,status,created_at,updated_at')
          .order('updated_at', { ascending: false })
          .limit(1000),
        serviceSupabase
          .from('marketing_prepared_publications')
          .select(
            'id,campaign_id,campaign_content_id,channel_variant_id,schedule_id,channel,copy,cta,hashtags,creative_asset_ids,status,prepared_at',
          )
          .order('prepared_at', { ascending: false })
          .limit(1000),
        serviceSupabase
          .from('marketing_publication_attempts')
          .select(
            'id,prepared_publication_id,attempt_number,status,started_at,completed_at,external_publication_ref,failure_code',
          )
          .order('attempt_number', { ascending: false })
          .limit(2000),
      ]);
      const failed = schedules.error ?? publications.error ?? attempts.error;
      if (failed) {
        throw new Error(
          `LIHEN_MARKETING_SOCIAL_EDITORIAL_READ_FAILED:${failed.message ?? 'UNKNOWN'}`,
        );
      }
      data = {
        schedules: schedules.data ?? [],
        publications: publications.data ?? [],
        attempts: attempts.data ?? [],
      };
    } else if (action === 'SAVE_CONTENT_SCHEDULE') {
      const result = await serviceSupabase.rpc(
        'save_marketing_content_schedule_server_controlled',
        {
          p_actor_id: user.id,
          p_operation_key: requiredString(payload, 'operationKey').trim(),
          p_id: requiredString(payload, 'id'),
          p_channel_variant_id: requiredString(payload, 'channelVariantId'),
          p_scheduled_for: requiredString(payload, 'scheduledFor'),
          p_timezone: requiredString(payload, 'timezone'),
          p_status: requiredString(payload, 'status'),
          p_created_at: requiredString(payload, 'createdAt'),
          p_updated_at: requiredString(payload, 'updatedAt'),
        },
      );

      data = result.data;
      error = result.error;
    } else if (action === 'SAVE_PREPARED_PUBLICATION') {
      const result = await serviceSupabase.rpc(
        'save_marketing_prepared_publication_server_controlled',
        {
          p_actor_id: user.id,
          p_operation_key: requiredString(payload, 'operationKey').trim(),
          p_id: requiredString(payload, 'id'),
          p_campaign_id: requiredString(payload, 'campaignId'),
          p_campaign_content_id: requiredString(payload, 'campaignContentId'),
          p_channel_variant_id: requiredString(payload, 'channelVariantId'),
          p_schedule_id: nullableString(payload, 'scheduleId'),
          p_channel: requiredString(payload, 'channel'),
          p_copy: requiredString(payload, 'copy'),
          p_cta: nullableString(payload, 'callToAction'),
          p_hashtags: stringArray(payload, 'hashtags'),
          p_creative_asset_ids: stringArray(payload, 'creativeAssetIds'),
          p_status: requiredString(payload, 'status'),
          p_prepared_at: requiredString(payload, 'preparedAt'),
        },
      );

      data = result.data;
      error = result.error;
    } else if (action === 'ASSESS_PUBLICATION_OPERATION') {
      data = await assess();
    } else if (action === 'CREATE_PUBLICATION_ATTEMPT') {
      const assessment = await assess();
      requireOperationalConfirmation(payload, assessment, action);
      const result = await serviceSupabase.rpc(
        'create_marketing_publication_attempt_server_controlled',
        {
          p_actor_id: user.id,
          p_operation_key: `operational:first:${assessment.preparedPublicationId}`,
          // One identity per publication makes concurrent CREATE idempotent.
          p_id: assessment.preparedPublicationId,
          p_prepared_publication_id: requiredString(payload, 'preparedPublicationId'),
        },
      );

      data = result.data;
      error = result.error;
    } else if (action === 'EXECUTE_PUBLICATION_ATTEMPT') {
      const assessment = await assess();
      requireOperationalConfirmation(payload, assessment, action);
      if (payload.attemptId !== assessment.attemptId)
        throw new Error('LIHEN_MARKETING_SOCIAL_ATTEMPT_MISMATCH');
      if (!metaPublicationEnabled()) {
        return json(
          {
            error: 'LIHEN_MARKETING_SOCIAL_META_PUBLICATION_DISABLED',
            externalPublication: false,
          },
          409,
        );
      }

      const attemptId = requiredString(payload, 'attemptId');
      const preparedPublicationId = requiredString(payload, 'preparedPublicationId');
      const productId = requiredString(payload, 'productId');
      // Fresh server keys prevent replay of an idempotent START into another provider call.
      const invocationId = crypto.randomUUID();
      const startOperationKey = `operational:start:${invocationId}`;
      const completionOperationKey = `operational:complete:${invocationId}`;

      const { data: executionData, error: executionError } = await serviceSupabase.rpc(
        'get_marketing_publication_execution_server_controlled',
        {
          p_actor_id: user.id,
          p_attempt_id: attemptId,
          p_prepared_publication_id: preparedPublicationId,
        },
      );

      if (executionError) {
        throw new Error(
          `LIHEN_MARKETING_SOCIAL_EXECUTION_READ_FAILED:${executionError.message ?? 'UNKNOWN'}`,
        );
      }

      const executionRow = Array.isArray(executionData) ? executionData[0] : null;

      if (!executionRow) {
        return json(
          {
            error: 'LIHEN_MARKETING_SOCIAL_EXECUTION_NOT_FOUND',
            externalPublication: false,
          },
          404,
        );
      }

      const publication: PreparedPublicationRow = {
        id: String(executionRow.publication_id),
        channel: assessment.publication.channel,
        copy: assessment.publication.copy,
        cta: assessment.publication.cta,
        hashtags: assessment.publication.hashtags ?? [],
        creative_asset_ids: assessment.publication.creative_asset_ids ?? [],
        status: String(executionRow.publication_status),
      };

      if (publication.status !== 'APPROVED') {
        return json(
          {
            error: 'LIHEN_MARKETING_SOCIAL_PUBLICATION_NOT_APPROVED',
            externalPublication: false,
          },
          409,
        );
      }

      if (!['FACEBOOK', 'INSTAGRAM_FEED', 'INSTAGRAM_STORY', 'INSTAGRAM_REEL'].includes(publication.channel)) {
        return json(
          {
            error: 'LIHEN_MARKETING_SOCIAL_META_CHANNEL_UNSUPPORTED',
            externalPublication: false,
          },
          409,
        );
      }

      if (
        String(executionRow.prepared_publication_id) !== publication.id ||
        String(executionRow.attempt_status) !== 'PENDING'
      ) {
        return json(
          {
            error: 'LIHEN_MARKETING_SOCIAL_PUBLICATION_ATTEMPT_NOT_PENDING',
            externalPublication: false,
          },
          409,
        );
      }

      if (!publication.creative_asset_ids?.[0]) {
        return json(
          { error: 'LIHEN_MARKETING_SOCIAL_MEDIA_REQUIRED', externalPublication: false },
          409,
        );
      }

      // Resolve only persisted, authorized media. Browser-provided media URLs are never accepted.
      const media = await resolveAuthorizedPublicationMedia(userSupabase, publication, productId);

      // All provider/config preflight is intentionally completed before START.
      requiredEnv('META_GRAPH_API_VERSION');
      if (publication.channel === 'FACEBOOK') {
        requiredEnv('META_FACEBOOK_ACCESS_TOKEN');
        requiredEnv('META_FACEBOOK_PAGE_ID');
      } else {
        requiredEnv('META_INSTAGRAM_ACCESS_TOKEN');
        requiredEnv('META_INSTAGRAM_ACCOUNT_ID');
      }

      // Revalidate after media/config resolution; publish only the explicitly confirmed content.
      requireOperationalConfirmation(payload, await assess(), action);
      const started = await serviceSupabase.rpc(
        'start_marketing_publication_attempt_server_controlled',
        {
          p_actor_id: user.id,
          p_operation_key: startOperationKey,
          p_attempt_id: attemptId,
        },
      );
      if (started.error) {
        return json(
          {
            error: 'LIHEN_MARKETING_SOCIAL_SERVER_START_FAILED',
            detail: started.error.message ?? null,
            externalPublication: false,
          },
          409,
        );
      }

      let providerResult: Awaited<ReturnType<typeof publishMetaMedia>>;
      try {
        providerResult = await publishMetaMedia(publication, media);
      } catch (providerError) {
        console.error('MARKETING_SOCIAL_META_PROVIDER_FAILED', providerError);
        providerResult = { outcome: 'FAILED', failureCode: 'META_PROVIDER_EXCEPTION' };
      }

      const completed = await serviceSupabase.rpc(
        'complete_marketing_publication_attempt_server_controlled',
        {
          p_actor_id: user.id,
          p_operation_key: completionOperationKey,
          p_attempt_id: attemptId,
          p_outcome: providerResult.outcome,
          p_result_value:
            providerResult.outcome === 'SUCCEEDED'
              ? providerResult.externalPublicationRef
              : providerResult.failureCode,
        },
      );
      if (completed.error) {
        return json(
          {
            error: 'LIHEN_MARKETING_SOCIAL_SERVER_COMPLETE_FAILED',
            detail: completed.error.message ?? null,
            externalPublication: providerResult.outcome === 'SUCCEEDED',
          },
          409,
        );
      }

      data = completed.data;
      error = null;
      return json({
        data: Array.isArray(data) ? (data[0] ?? null) : data,
        externalPublication: providerResult.outcome === 'SUCCEEDED',
      });
    } else {
      return json({ error: 'LIHEN_MARKETING_SOCIAL_ACTION_NOT_ALLOWED' }, 400);
    }

    if (error) {
      console.error('MARKETING_SOCIAL_SERVER_WRITE_FAILED', error);

      return json(
        {
          error: 'LIHEN_MARKETING_SOCIAL_SERVER_WRITE_FAILED',
          detail: error.message ?? null,
          externalPublication: false,
        },
        409,
      );
    }

    return json({
      data: Array.isArray(data) ? (data[0] ?? null) : data,
      externalPublication: false,
    });
  } catch (error) {
    console.error('MARKETING_SOCIAL_RUNTIME_FAILED', error);

    return json(
      {
        error: error instanceof Error ? error.message : 'LIHEN_MARKETING_SOCIAL_RUNTIME_FAILED',
        externalPublication: false,
      },
      400,
    );
  }
});
