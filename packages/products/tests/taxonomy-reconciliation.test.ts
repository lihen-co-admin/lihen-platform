import { describe, expect, it } from 'vitest';
import { reconcileTaxonomyReference } from '../src/domain/taxonomy-reconciliation';

describe('taxonomy reconciliation', () => {
  it('marks high-confidence source as NEW_ENTITY when master is empty', () => {
    expect(reconcileTaxonomyReference({
      referenceId: 'brand-1', entityType: 'BRAND', displayName: 'Kaba', sourceConfidence: 'HIGH'
    }, [])).toMatchObject({ status: 'NEW_ENTITY', matchMethod: 'NONE' });
  });

  it('requires review for uncertain source labels', () => {
    expect(reconcileTaxonomyReference({
      referenceId: 'brand-2', entityType: 'BRAND', displayName: 'Unknown Logo', sourceConfidence: 'LOW', sourceReviewRequired: true
    }, [])).toMatchObject({ status: 'REVIEW_REQUIRED' });
  });

  it('matches exact normalized unique name only within the same entity type', () => {
    const result = reconcileTaxonomyReference({
      referenceId: 'brand-3', entityType: 'BRAND', displayName: 'Ritual Botánico', sourceConfidence: 'HIGH'
    }, [{ id: 'b1', entityType: 'BRAND', name: 'RITUAL BOTANICO' }]);
    expect(result).toMatchObject({ status: 'MATCHED', selectedId: 'b1', confidence: 95 });
  });
});
