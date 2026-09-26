import {
  assessPublicationReconciliation,
  type PublicationReconciliationAssessment,
} from '../../domain/publication-reconciliation';
import type { MarketingSocialRepository } from '../../ports/marketing-social-repository';
import type { AssessPublicationReconciliationQuery } from './assess-publication-reconciliation.query';

export class AssessPublicationReconciliationHandler {
  public constructor(
    private readonly repository: MarketingSocialRepository,
  ) {}

  public async execute(
    query: AssessPublicationReconciliationQuery,
  ): Promise<readonly PublicationReconciliationAssessment[]> {
    if (
      !Number.isFinite(query.uncertaintyWindowMs) ||
      query.uncertaintyWindowMs < 0
    ) {
      throw new RangeError(
        'uncertaintyWindowMs must be a finite non-negative number.',
      );
    }

    const attempts =
      await this.repository
        .listPublicationAttemptsByPreparedPublicationId(
          query.preparedPublicationId,
        );

    return attempts.map((attempt) =>
      assessPublicationReconciliation({
        attempt,
        now: query.now,
        uncertaintyWindowMs: query.uncertaintyWindowMs,
      }),
    );
  }
}
