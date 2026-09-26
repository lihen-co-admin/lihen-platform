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
