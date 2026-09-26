import {
  ExecutePublicationAttemptHandler,
  InMemoryMarketingSocialRepository,
  InMemorySocialPublishingAdapter,
  PrepareDuePublicationAttemptHandler,
  type ContentSchedule,
  type PreparedPublication,
  type PublicationAttempt,
} from '@lihen/marketing';

export interface SocialPublicationE2EResult {
  readonly schedule: ContentSchedule;
  readonly publication: PreparedPublication;
  readonly attempt: PublicationAttempt;
  readonly externalExecution: false;
  readonly simulation: true;
}

export async function runSocialPublicationE2E(
  input: {
    readonly schedule: ContentSchedule;
    readonly publication: PreparedPublication;
    readonly now: Date;
    readonly attemptId: string;
  },
): Promise<SocialPublicationE2EResult> {
  const repository = new InMemoryMarketingSocialRepository();
  const publisher = new InMemorySocialPublishingAdapter();

  await repository.saveContentSchedule(
    input.schedule,
    { operationKey: `social-11:schedule:${input.schedule.id}` },
  );

  await repository.savePreparedPublication(
    input.publication,
    { operationKey: `social-11:publication:${input.publication.id}` },
  );

  const prepare = new PrepareDuePublicationAttemptHandler(repository);

  const pending = await prepare.execute({
    preparedPublicationId: input.publication.id,
    attemptId: input.attemptId,
    operationKey: `social-11:attempt:${input.attemptId}`,
    now: input.now,
  });

  const execute = new ExecutePublicationAttemptHandler(
    repository,
    publisher,
  );

  const attempt = await execute.execute({
    preparedPublicationId: input.publication.id,
    attemptId: pending.id,
    startOperationKey: `social-11:start:${pending.id}`,
    completionOperationKey: `social-11:complete:${pending.id}`,
  });

  return {
    schedule: input.schedule,
    publication: input.publication,
    attempt,
    externalExecution: false,
    simulation: true,
  };
}

export interface SocialPublicationReconciliationE2EResult {
  readonly schedule: ContentSchedule;
  readonly publication: PreparedPublication;
  readonly attempt: PublicationAttempt;
  readonly assessments: readonly import('@lihen/marketing').PublicationReconciliationAssessment[];
  readonly externalExecution: false;
  readonly readOnlyAssessment: true;
}

export async function runSocialPublicationReconciliationE2E(
  input: {
    readonly schedule: ContentSchedule;
    readonly publication: PreparedPublication;
    readonly now: Date;
    readonly attemptId: string;
    readonly uncertaintyWindowMs: number;
    readonly elapsedMs: number;
  },
): Promise<SocialPublicationReconciliationE2EResult> {
  const {
    AssessPublicationReconciliationHandler,
  } = await import('@lihen/marketing');

  const repository = new InMemoryMarketingSocialRepository();

  await repository.saveContentSchedule(
    input.schedule,
    {
      operationKey:
        `social-13:schedule:${input.schedule.id}`,
    },
  );

  await repository.savePreparedPublication(
    input.publication,
    {
      operationKey:
        `social-13:publication:${input.publication.id}`,
    },
  );

  const prepare =
    new PrepareDuePublicationAttemptHandler(repository);

  const pending = await prepare.execute({
    preparedPublicationId: input.publication.id,
    attemptId: input.attemptId,
    operationKey:
      `social-13:attempt:${input.attemptId}`,
    now: input.now,
  });

  const attempt =
    await repository.startPublicationAttempt(
      { id: pending.id },
      {
        operationKey:
          `social-13:start:${pending.id}`,
      },
    );

  const assessmentNow =
    new Date(attempt.startedAt!.getTime() + input.elapsedMs);

  const assess =
    new AssessPublicationReconciliationHandler(repository);

  const assessments = await assess.execute({
    preparedPublicationId: input.publication.id,
    now: assessmentNow,
    uncertaintyWindowMs: input.uncertaintyWindowMs,
  });

  return {
    schedule: input.schedule,
    publication: input.publication,
    attempt,
    assessments,
    externalExecution: false,
    readOnlyAssessment: true,
  };
}
