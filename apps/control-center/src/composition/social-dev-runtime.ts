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
  readonly externalPublication: boolean;
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

  if (
    !data
    || !data.data
    || typeof data.externalPublication !== 'boolean'
  ) {
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

export async function executeControlledSocialPublicationInDev(
  client: SocialEdgeFunctionClient =
    getBrowserSupabaseClient(import.meta.env),
): Promise<unknown> {
  return invoke(
    client,
    'EXECUTE_PUBLICATION_ATTEMPT',
    {
      attemptId: '5cdfdfb5-f235-4f81-a08a-19908883f2de',
      preparedPublicationId:
        '7d949f5c-48b3-4454-b5eb-e7c28a9c5b13',
      productId: '50355067-02bd-4eb7-bed6-28f68bd4b8ec',
      startOperationKey:
        'social-dev:first-real-instagram:start:5cdfdfb5',
      completionOperationKey:
        'social-dev:first-real-instagram:complete:5cdfdfb5',
    },
  );
}
