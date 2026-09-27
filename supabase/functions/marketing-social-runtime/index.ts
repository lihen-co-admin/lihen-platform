import { createClient } from 'supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Action =
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

interface PublicationAttemptRow {
  readonly id: string;
  readonly prepared_publication_id: string;
  readonly status: string;
}

interface ProductImageRpcRow {
  readonly id: unknown;
  readonly product_id: unknown;
  readonly public_url: unknown;
  readonly status: unknown;
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
    (publication.hashtags ?? [])
      .map((tag) => tag.startsWith('#') ? tag : `#${tag}`)
      .join(' '),
  ].filter(Boolean).join('\n\n');
}

async function resolveAuthorizedProductImageUrl(
  client: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }> },
  productId: string,
  productImageId: string,
): Promise<string> {
  const result = await client.rpc('get_product_images', { p_product_id: productId });
  if (result.error) {
    throw new Error(`LIHEN_PRODUCT_IMAGE_RESOLUTION_FAILED:${result.error.message ?? 'UNKNOWN'}`);
  }

  const rows = Array.isArray(result.data) ? result.data as ProductImageRpcRow[] : [];
  const row = rows.find((candidate) =>
    String(candidate.id) === productImageId
    && String(candidate.product_id) === productId
    && String(candidate.status) === 'ACTIVE'
  );
  if (!row) throw new Error('LIHEN_PRODUCT_IMAGE_NOT_AUTHORIZED_OR_NOT_FOUND');

  const publicUrl = String(row.public_url ?? '').trim();
  if (!publicUrl) throw new Error('LIHEN_PRODUCT_IMAGE_SOURCE_UNAVAILABLE');
  return publicUrl;
}

async function publishMetaImage(
  publication: PreparedPublicationRow,
  publicUrl: string,
): Promise<{ outcome: 'SUCCEEDED'; externalPublicationRef: string } | { outcome: 'FAILED'; failureCode: string }> {
  const accessToken = publication.channel === 'FACEBOOK'
    ? requiredEnv('META_FACEBOOK_ACCESS_TOKEN')
    : requiredEnv('META_INSTAGRAM_ACCESS_TOKEN');
  const graphApiVersion = requiredEnv('META_GRAPH_API_VERSION');
  const caption = publicationCaption(publication);

  const post = async (path: string, body: Record<string, string>): Promise<MetaGraphResponse> => {
    const url = new URL(`https://graph.facebook.com/${graphApiVersion}/${path}`);
    const params = new URLSearchParams(body);
    params.set('access_token', accessToken);
    const response = await fetch(url, { method: 'POST', body: params });
    return await response.json() as MetaGraphResponse;
  };

  if (publication.channel === 'FACEBOOK') {
    const pageId = requiredEnv('META_FACEBOOK_PAGE_ID');
    const result = await post(`${pageId}/photos`, { url: publicUrl, caption });
    return result.id
      ? { outcome: 'SUCCEEDED', externalPublicationRef: result.id }
      : { outcome: 'FAILED', failureCode: result.error?.code ? `META_${result.error.code}` : 'META_PUBLICATION_FAILED' };
  }

  if (publication.channel === 'INSTAGRAM_FEED' || publication.channel === 'INSTAGRAM_STORY') {
    const instagramAccountId = requiredEnv('META_INSTAGRAM_ACCOUNT_ID');
    const container = publication.channel === 'INSTAGRAM_STORY'
      ? { media_type: 'STORIES', image_url: publicUrl }
      : { image_url: publicUrl, caption };
    const created = await post(`${instagramAccountId}/media`, container);
    if (!created.id) {
      return { outcome: 'FAILED', failureCode: created.error?.code ? `META_${created.error.code}` : 'META_CONTAINER_CREATE_FAILED' };
    }
    const published = await post(`${instagramAccountId}/media_publish`, { creation_id: created.id });
    return published.id
      ? { outcome: 'SUCCEEDED', externalPublicationRef: published.id }
      : { outcome: 'FAILED', failureCode: published.error?.code ? `META_${published.error.code}` : 'META_MEDIA_PUBLISH_FAILED' };
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

function requiredString(
  payload: Record<string, unknown>,
  key: string,
): string {
  const value = payload[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`LIHEN_MARKETING_SOCIAL_PAYLOAD_${key.toUpperCase()}_REQUIRED`);
  }

  return value;
}

function nullableString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];

  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`LIHEN_MARKETING_SOCIAL_PAYLOAD_${key.toUpperCase()}_INVALID`);
  }

  return value;
}

function stringArray(
  payload: Record<string, unknown>,
  key: string,
): string[] {
  const value = payload[key];

  if (value === undefined || value === null) return [];

  if (
    !Array.isArray(value)
    || value.some((item) => typeof item !== 'string')
  ) {
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

    const userSupabase = createClient(
      supabaseUrl,
      publishableKey(),
      {
        global: {
          headers: { Authorization: authorization },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED');
    }

    const serviceSupabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const token = authorization.slice('Bearer '.length);

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'LIHEN_AUTH_INVALID' }, 401);
    }

    const { data: profile, error: profileError } =
      await userSupabase
        .from('profiles')
        .select('id,role_code,authorization_status')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError) {
      console.error(
        'MARKETING_SOCIAL_PROFILE_LOOKUP_FAILED',
        profileError,
      );
      return json(
        { error: 'LIHEN_AUTHORIZATION_LOOKUP_FAILED' },
        500,
      );
    }

    if (
      !profile
      || profile.authorization_status !== 'ACTIVE'
      || !['OWNER', 'ADMIN'].includes(profile.role_code)
    ) {
      return json(
        { error: 'LIHEN_MARKETING_SOCIAL_FORBIDDEN' },
        403,
      );
    }

    const body = await req.json() as RuntimeRequest;
    const action = body.action;
    const payload = body.payload;

    if (!action || !payload || typeof payload !== 'object') {
      return json(
        { error: 'LIHEN_MARKETING_SOCIAL_REQUEST_INVALID' },
        400,
      );
    }

    let data: unknown;
    let error: { message?: string } | null = null;

    if (action === 'SAVE_CONTENT_SCHEDULE') {
      const result = await serviceSupabase.rpc(
        'save_marketing_content_schedule_server_controlled',
        {
          p_actor_id: user.id,
          p_operation_key:
            requiredString(payload, 'operationKey').trim(),
          p_id: requiredString(payload, 'id'),
          p_channel_variant_id:
            requiredString(payload, 'channelVariantId'),
          p_scheduled_for:
            requiredString(payload, 'scheduledFor'),
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
          p_operation_key:
            requiredString(payload, 'operationKey').trim(),
          p_id: requiredString(payload, 'id'),
          p_campaign_id:
            requiredString(payload, 'campaignId'),
          p_campaign_content_id:
            requiredString(payload, 'campaignContentId'),
          p_channel_variant_id:
            requiredString(payload, 'channelVariantId'),
          p_schedule_id:
            nullableString(payload, 'scheduleId'),
          p_channel: requiredString(payload, 'channel'),
          p_copy: requiredString(payload, 'copy'),
          p_cta: nullableString(payload, 'callToAction'),
          p_hashtags: stringArray(payload, 'hashtags'),
          p_creative_asset_ids:
            stringArray(payload, 'creativeAssetIds'),
          p_status: requiredString(payload, 'status'),
          p_prepared_at:
            requiredString(payload, 'preparedAt'),
        },
      );

      data = result.data;
      error = result.error;
    } else if (action === 'CREATE_PUBLICATION_ATTEMPT') {
      const result = await serviceSupabase.rpc(
        'create_marketing_publication_attempt_server_controlled',
        {
          p_actor_id: user.id,
          p_operation_key:
            requiredString(payload, 'operationKey').trim(),
          p_id: requiredString(payload, 'id'),
          p_prepared_publication_id:
            requiredString(payload, 'preparedPublicationId'),
        },
      );

      data = result.data;
      error = result.error;
    } else if (action === 'EXECUTE_PUBLICATION_ATTEMPT') {
      if (!metaPublicationEnabled()) {
        return json({
          error: 'LIHEN_MARKETING_SOCIAL_META_PUBLICATION_DISABLED',
          externalPublication: false,
        }, 409);
      }

      const attemptId = requiredString(payload, 'attemptId');
      const preparedPublicationId = requiredString(payload, 'preparedPublicationId');
      const productId = requiredString(payload, 'productId');
      const startOperationKey = requiredString(payload, 'startOperationKey').trim();
      const completionOperationKey = requiredString(payload, 'completionOperationKey').trim();

      const { data: publicationData, error: publicationError } = await serviceSupabase
        .from('marketing_prepared_publications')
        .select('id,channel,copy,cta,hashtags,creative_asset_ids,status')
        .eq('id', preparedPublicationId)
        .maybeSingle();
      if (publicationError || !publicationData) {
        return json({ error: 'LIHEN_MARKETING_SOCIAL_PREPARED_PUBLICATION_NOT_FOUND', externalPublication: false }, 404);
      }
      const publication = publicationData as PreparedPublicationRow;
      if (publication.status !== 'APPROVED') {
        return json({ error: 'LIHEN_MARKETING_SOCIAL_PUBLICATION_NOT_APPROVED', externalPublication: false }, 409);
      }
      if (!['FACEBOOK', 'INSTAGRAM_FEED', 'INSTAGRAM_STORY'].includes(publication.channel)) {
        return json({ error: 'LIHEN_MARKETING_SOCIAL_META_CHANNEL_UNSUPPORTED', externalPublication: false }, 409);
      }

      const { data: attemptData, error: attemptError } = await serviceSupabase
        .from('marketing_publication_attempts')
        .select('id,prepared_publication_id,status')
        .eq('id', attemptId)
        .maybeSingle();
      if (attemptError || !attemptData) {
        return json({ error: 'LIHEN_MARKETING_SOCIAL_PUBLICATION_ATTEMPT_NOT_FOUND', externalPublication: false }, 404);
      }
      const attempt = attemptData as PublicationAttemptRow;
      if (attempt.prepared_publication_id !== publication.id || attempt.status !== 'PENDING') {
        return json({ error: 'LIHEN_MARKETING_SOCIAL_PUBLICATION_ATTEMPT_NOT_PENDING', externalPublication: false }, 409);
      }

      const productImageId = publication.creative_asset_ids?.[0];
      if (!productImageId) {
        return json({ error: 'LIHEN_MARKETING_SOCIAL_PRODUCT_IMAGE_REQUIRED', externalPublication: false }, 409);
      }

      // Resolve the persisted creative asset through the existing authorized product-image boundary.
      // No arbitrary browser-provided media URL is accepted.
      const publicUrl = await resolveAuthorizedProductImageUrl(
        userSupabase,
        productId,
        productImageId,
      );

      // All provider/config preflight is intentionally completed before START.
      requiredEnv('META_GRAPH_API_VERSION');
      if (publication.channel === 'FACEBOOK') {
        requiredEnv('META_FACEBOOK_ACCESS_TOKEN');
        requiredEnv('META_FACEBOOK_PAGE_ID');
      } else {
        requiredEnv('META_INSTAGRAM_ACCESS_TOKEN');
        requiredEnv('META_INSTAGRAM_ACCOUNT_ID');
      }

      const started = await serviceSupabase.rpc(
        'start_marketing_publication_attempt_server_controlled',
        {
          p_actor_id: user.id,
          p_operation_key: startOperationKey,
          p_attempt_id: attemptId,
        },
      );
      if (started.error) {
        return json({
          error: 'LIHEN_MARKETING_SOCIAL_SERVER_START_FAILED',
          detail: started.error.message ?? null,
          externalPublication: false,
        }, 409);
      }

      let providerResult: Awaited<ReturnType<typeof publishMetaImage>>;
      try {
        providerResult = await publishMetaImage(publication, publicUrl);
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
          p_result_value: providerResult.outcome === 'SUCCEEDED'
            ? providerResult.externalPublicationRef
            : providerResult.failureCode,
        },
      );
      if (completed.error) {
        return json({
          error: 'LIHEN_MARKETING_SOCIAL_SERVER_COMPLETE_FAILED',
          detail: completed.error.message ?? null,
          externalPublication: providerResult.outcome === 'SUCCEEDED',
        }, 409);
      }

      data = completed.data;
      error = null;
      return json({
        data: Array.isArray(data) ? data[0] ?? null : data,
        externalPublication: providerResult.outcome === 'SUCCEEDED',
      });
    } else {
      return json(
        { error: 'LIHEN_MARKETING_SOCIAL_ACTION_NOT_ALLOWED' },
        400,
      );
    }

    if (error) {
      console.error(
        'MARKETING_SOCIAL_SERVER_WRITE_FAILED',
        error,
      );

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
      data: Array.isArray(data) ? data[0] ?? null : data,
      externalPublication: false,
    });
  } catch (error) {
    console.error('MARKETING_SOCIAL_RUNTIME_FAILED', error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'LIHEN_MARKETING_SOCIAL_RUNTIME_FAILED',
        externalPublication: false,
      },
      400,
    );
  }
});
