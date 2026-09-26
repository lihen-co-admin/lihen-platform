import { getBrowserSupabaseClient } from '@lihen/database';
import type {
  ContentSchedule,
  PreparedPublication,
  PublicationAttempt,
} from '@lihen/marketing';

interface EdgeInvokeResult<T> {
  readonly data: T | null;
  readonly error: {
    readonly message?: string;
  } | null;
}

interface SocialEdgeFunctionClient {
  readonly functions: {
    invoke<T>(
      functionName: string,
      options: {
        readonly body: Readonly<Record<string, unknown>>;
      },
    ): PromiseLike<EdgeInvokeResult<T>>;
  };
}

interface RuntimeResponse<T> {
  readonly data: T | null;
  readonly externalPublication: false;
}

function dates(schedule: ContentSchedule) {
  return {
    ...schedule,
    scheduledFor: schedule.scheduledFor.toISOString(),
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

function publicationPayload(publication: PreparedPublication) {
  return {
    ...publication,
    preparedAt: publication.preparedAt.toISOString(),
  };
}

async function invoke<T>(
  client: SocialEdgeFunctionClient,
  action: string,
  payload: Readonly<Record<string, unknown>>,
): Promise<T> {
  const { data, error } =
    await client.functions.invoke<RuntimeResponse<T>>(
      'marketing-social-runtime',
      {
        body: { action, payload },
      },
    );

  if (error) {
    const context = (
      error as {
        readonly context?: {
          json?: () => Promise<unknown>;
        };
      }
    ).context;

    if (context?.json) {
      try {
        const body = await context.json();

        if (
          body &&
          typeof body === 'object' &&
          'error' in body &&
          typeof body.error === 'string'
        ) {
          throw new Error(body.error);
        }
      } catch (cause) {
        if (cause instanceof Error) {
          throw cause;
        }
      }
    }

    throw new Error(
      `LIHEN_MARKETING_SOCIAL_RUNTIME_INVOKE_FAILED:${
        error.message ?? 'UNKNOWN'
      }`,
    );
  }

  if (!data || !data.data || data.externalPublication !== false) {
    throw new Error(
      'LIHEN_MARKETING_SOCIAL_RUNTIME_INVALID_RESPONSE',
    );
  }

  return data.data;
}

export async function createControlledSocialDevCase(
  input: {
    readonly schedule: ContentSchedule;
    readonly publication: PreparedPublication;
    readonly attemptId: string;
  },
  client: SocialEdgeFunctionClient =
    getBrowserSupabaseClient(import.meta.env),
): Promise<{
  readonly attempt: PublicationAttempt;
  readonly externalPublication: false;
}> {
  await invoke(
    client,
    'SAVE_CONTENT_SCHEDULE',
    {
      ...dates(input.schedule),
      operationKey: `social-dev:schedule:${input.schedule.id}`,
    },
  );

  await invoke(
    client,
    'SAVE_PREPARED_PUBLICATION',
    {
      ...publicationPayload(input.publication),
      operationKey:
        `social-dev:publication:${input.publication.id}`,
    },
  );

  const attempt = await invoke<PublicationAttempt>(
    client,
    'CREATE_PUBLICATION_ATTEMPT',
    {
      id: input.attemptId,
      preparedPublicationId: input.publication.id,
      operationKey: `social-dev:attempt:${input.attemptId}`,
    },
  );

  if (attempt.status !== 'PENDING') {
    throw new Error(
      'LIHEN_MARKETING_SOCIAL_DEV_ATTEMPT_NOT_PENDING',
    );
  }

  return {
    attempt,
    externalPublication: false,
  };
}

export async function verifySocialPublicationBlockedInDev(
  client: SocialEdgeFunctionClient =
    getBrowserSupabaseClient(import.meta.env),
): Promise<never> {
  await invoke(
    client,
    'EXECUTE_PUBLICATION_ATTEMPT',
    {
      attemptId: '622102d8-93d4-43a0-9ecb-4a6180e55fb9',
      preparedPublicationId:
        'dbb8e29c-dac5-4a67-904e-0eebdde45d82',
      productId: '00000000-0000-0000-0000-000000000000',
      startOperationKey:
        'social-dev:block-smoke:start:622102d8',
      completionOperationKey:
        'social-dev:block-smoke:complete:622102d8',
    },
  );

  throw new Error(
    'LIHEN_MARKETING_SOCIAL_BLOCK_SMOKE_UNEXPECTED_SUCCESS',
  );
}
