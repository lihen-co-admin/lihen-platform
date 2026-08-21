import { describe, expect, it } from 'vitest';
import {
  normalizeCatalogIdentityText,
  reconcileCatalogImageEvidence,
  type CatalogImageEvidence,
} from '../src';

const evidence: CatalogImageEvidence = {
  evidenceId: 'CATV1-P006-R1L',
  sourceKey: 'CATALOGO_LIHEN_V5_ACTL_V1',
  page: 6,
  slot: 'R1L',
  productName: 'SHAMPOO KABA',
  brandLabel: 'Kaba',
  evidenceSha256: '8ead3e09e31a064951c05a0198ed313abdf4a2dfd0b6bdf0aae92eb38cc9e9bc',
  evidencePath: 'product_images/p006_1_1_shampoo-kaba.jpg',
  auditReviewStatus: 'OK',
};

describe('catalog image reconciliation', () => {
  it('normalizes accents, punctuation and whitespace without fuzzy replacement', () => {
    expect(normalizeCatalogIdentityText('  Ácido-Hialurónico  ')).toBe('ACIDO HIALURONICO');
  });

  it('does not invent a product id when the product master is empty', () => {
    expect(reconcileCatalogImageEvidence(evidence, [])).toEqual({
      evidenceId: evidence.evidenceId,
      status: 'UNRESOLVED_PRODUCT',
      matchMethod: 'NONE',
      confidence: 0,
      candidateProductIds: [],
      reasons: ['PRODUCT_MASTER_EMPTY'],
    });
  });

  it('auto-matches only one exact normalized name + brand', () => {
    const result = reconcileCatalogImageEvidence(evidence, [
      { productId: '11111111-1111-4111-8111-111111111111', name: 'Shampoo Kaba', brandName: 'KABA' },
    ]);
    expect(result.status).toBe('MATCHED_EXACT');
    expect(result.selectedProductId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.confidence).toBe(100);
  });

  it('requires review when only the name can be confirmed', () => {
    const result = reconcileCatalogImageEvidence(evidence, [
      { productId: '11111111-1111-4111-8111-111111111111', name: 'Shampoo Kaba', brandName: 'Otra marca' },
    ]);
    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.matchMethod).toBe('NORMALIZED_NAME_ONLY');
    expect(result.candidateProductIds).toHaveLength(1);
  });

  it('never chooses between duplicate exact candidates', () => {
    const result = reconcileCatalogImageEvidence(evidence, [
      { productId: '11111111-1111-4111-8111-111111111111', name: 'Shampoo Kaba', brandName: 'Kaba' },
      { productId: '22222222-2222-4222-8222-222222222222', name: 'Shampoo Kaba', brandName: 'Kaba' },
    ]);
    expect(result.status).toBe('AMBIGUOUS_MATCH');
    expect(result.selectedProductId).toBeUndefined();
    expect(result.candidateProductIds).toHaveLength(2);
  });
});
