export type ProductImportDecision = 'ACCEPT' | 'REVIEW' | 'REJECT';

export interface ProductImportDecisionContext {
  readonly hasStableIdentity: boolean;
  readonly hasBusinessLine: boolean;
  readonly hasConflictingEvidence: boolean;
}

export interface ProductImportDecisionStrategy {
  readonly key: string;
  decide(context: ProductImportDecisionContext): ProductImportDecision;
}

export const conservativeProductImportDecisionStrategy: ProductImportDecisionStrategy = {
  key: 'CONSERVATIVE_V1',
  decide(context) {
    if (context.hasConflictingEvidence) return 'REVIEW';
    if (!context.hasStableIdentity || !context.hasBusinessLine) return 'REVIEW';
    return 'ACCEPT';
  },
};
