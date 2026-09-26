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
