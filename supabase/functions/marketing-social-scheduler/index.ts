import { createClient } from 'supabase';

interface DuePublicationRow {
  readonly publication_id: string;
  readonly schedule_id: string;
  readonly scheduled_for: string;
  readonly channel: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function enabled(name: string): boolean {
  return Deno.env.get(name)?.trim().toLowerCase() === 'true';
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`LIHEN_MARKETING_SOCIAL_${name}_NOT_CONFIGURED`);
  }
  return value;
}

function schedulerLimit(): number {
  const raw = Deno.env.get('MARKETING_SOCIAL_SCHEDULER_BATCH_LIMIT')?.trim();
  if (!raw) return 10;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 50) {
    throw new Error('LIHEN_MARKETING_SOCIAL_SCHEDULER_BATCH_LIMIT_INVALID');
  }
  return value;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  if (!enabled('MARKETING_SOCIAL_SCHEDULER_ENABLED')) {
    return json({
      error: 'LIHEN_MARKETING_SOCIAL_SCHEDULER_DISABLED',
      externalPublication: false,
    }, 409);
  }

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const actorId = requiredEnv('MARKETING_SOCIAL_SCHEDULER_ACTOR_ID');

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

    const now = new Date().toISOString();
    const limit = schedulerLimit();

    const dueResult = await serviceSupabase.rpc(
      'list_marketing_due_publications_server_controlled',
      {
        p_actor_id: actorId,
        p_now: now,
        p_limit: limit,
      },
    );

    if (dueResult.error) {
      throw new Error(
        `LIHEN_MARKETING_SOCIAL_SCHEDULER_DUE_READ_FAILED:${dueResult.error.message ?? 'UNKNOWN'}`,
      );
    }

    const dueRows = Array.isArray(dueResult.data)
      ? dueResult.data as DuePublicationRow[]
      : [];

    const results: Array<Record<string, unknown>> = [];

    for (const publication of dueRows) {
      const attemptId = crypto.randomUUID();
      const claimOperationKey =
        `scheduler:${publication.publication_id}:initial`;

      const claim = await serviceSupabase.rpc(
        'claim_marketing_due_publication_server_controlled',
        {
          p_actor_id: actorId,
          p_prepared_publication_id: publication.publication_id,
          p_attempt_id: attemptId,
          p_operation_key: claimOperationKey,
          p_now: now,
        },
      );

      if (claim.error) {
        results.push({
          publicationId: publication.publication_id,
          outcome: 'CLAIM_FAILED',
          detail: claim.error.message ?? null,
        });
        continue;
      }

      const claimed =
        Array.isArray(claim.data) ? claim.data[0] ?? null : null;

      if (!claimed) {
        results.push({
          publicationId: publication.publication_id,
          outcome: 'SKIPPED',
        });
        continue;
      }

      /*
       * Claim-only mode remains the safe default. No provider execution occurs
       * unless the separate execution gate is explicitly enabled.
       */
      if (!enabled('MARKETING_SOCIAL_SCHEDULER_EXECUTION_ENABLED')) {
        results.push({
          publicationId: publication.publication_id,
          attemptId,
          outcome: 'CLAIMED_EXECUTION_DISABLED',
        });
        continue;
      }

      const actorAccessToken =
        requiredEnv('MARKETING_SOCIAL_SCHEDULER_ACTOR_ACCESS_TOKEN');

      const response = await fetch(
        `${supabaseUrl}/functions/v1/marketing-social-runtime`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${actorAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'EXECUTE_SCHEDULED_PUBLICATION_ATTEMPT',
            payload: {
              attemptId,
              preparedPublicationId: publication.publication_id,
            },
          }),
        },
      );

      let runtimeBody: Record<string, unknown> = {};

      try {
        runtimeBody = await response.json() as Record<string, unknown>;
      } catch {
        runtimeBody = {
          error: 'LIHEN_MARKETING_SOCIAL_SCHEDULER_RUNTIME_INVALID_RESPONSE',
        };
      }

      results.push({
        publicationId: publication.publication_id,
        attemptId,
        outcome: response.ok ? 'EXECUTED' : 'EXECUTION_FAILED',
        runtimeStatus: response.status,
        externalPublication:
          runtimeBody.externalPublication === true,
        runtimeError:
          typeof runtimeBody.error === 'string'
            ? runtimeBody.error
            : null,
      });
    }

    return json({
      checkedAt: now,
      due: dueRows.length,
      results,
      externalPublication:
        results.some((result) => result.externalPublication === true),
    });
  } catch (error) {
    console.error('MARKETING_SOCIAL_SCHEDULER_FAILED', error);

    return json({
      error: error instanceof Error
        ? error.message
        : 'LIHEN_MARKETING_SOCIAL_SCHEDULER_FAILED',
      externalPublication: false,
    }, 500);
  }
});
