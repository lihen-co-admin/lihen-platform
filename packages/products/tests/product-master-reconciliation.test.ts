import { describe, expect, it } from 'vitest';
import { reconcileCanonicalProductReference } from '../src';

const base = { referenceId: 'CATV1-P006-R1L', name: 'Shampoo Kaba', brandName: 'Kaba' };

describe('product master reconciliation', () => {
  it('marks a clean catalog reference as NEW_PRODUCT when the master is empty', () => {
    expect(reconcileCanonicalProductReference(base, []).status).toBe('NEW_PRODUCT');
  });

  it('requires review before matching source rows already flagged by audit', () => {
    expect(reconcileCanonicalProductReference({ ...base, sourceReviewRequired: true }, []).status).toBe('REVIEW_REQUIRED');
  });

  it('treats duplicate canonical catalog identity as conflict', () => {
    expect(reconcileCanonicalProductReference({ ...base, duplicateCanonicalIdentity: true }, []).status).toBe('CONFLICT');
  });

  it('matches an exact unique SKU with highest authority', () => {
    const out = reconcileCanonicalProductReference({ ...base, sku: 'BC-080' }, [
      { productId: '11111111-1111-4111-8111-111111111111', sku: 'bc-080', name: 'Otro nombre' },
    ]);
    expect(out.status).toBe('MATCHED');
    expect(out.matchMethod).toBe('SKU');
  });

  it('rejects contradictory SKU and catalog code identities', () => {
    const out = reconcileCanonicalProductReference({ ...base, sku: 'BC-080', catalogCode: 'CAT-9' }, [
      { productId: '11111111-1111-4111-8111-111111111111', sku: 'BC-080', name: 'A' },
      { productId: '22222222-2222-4222-8222-222222222222', catalogCode: 'CAT-9', name: 'B' },
    ]);
    expect(out.status).toBe('CONFLICT');
    expect(out.reasons).toContain('IDENTIFIER_CONFLICT');
  });

  it('matches one normalized name and brand but only suggests a name-only candidate', () => {
    const master = [{ productId: '11111111-1111-4111-8111-111111111111', name: 'SHAMPOO KABA', brandName: 'KABA' }];
    expect(reconcileCanonicalProductReference(base, master).status).toBe('MATCHED');
    expect(reconcileCanonicalProductReference({ ...base, brandName: 'Otra marca' }, master).status).toBe('POSSIBLE_MATCH');
  });
});
