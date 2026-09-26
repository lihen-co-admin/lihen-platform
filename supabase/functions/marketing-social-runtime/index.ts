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
  | 'CREATE_PUBLICATION_ATTEMPT';

interface RuntimeRequest {
  action?: Action;
  payload?: Record<string, unknown>;
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
