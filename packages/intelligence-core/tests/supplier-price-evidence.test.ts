import { describe, expect, it } from 'vitest';
import {
  prepareSupplierPriceEvidence,
  type PrepareSupplierPriceEvidenceInput,
} from '../src/capabilities/supplier-price-evidence';

function baseInput(): PrepareSupplierPriceEvidenceInput {
  return {
    correlationId: 'corr-gap021-1',
    context: {
      contextId: 'pricing-context-1',
      type: 'PRICING',
      entityId: 'product-1',
      attributes: {},
    },
    observation: {
      sourceRecordId: 'source-record-1',
      documentId: 'document-1',
      supplierId: 'supplier-1',
      observedAt: '2026-09-03T12:00:00.000Z',
      unitCost: 12000,
      suggestedSalePrice: 20000,
      extractionConfidence: 0.92,
      sourceEvidenceIds: ['document-evidence-1'],
    },
    reconciliation: {
      classification: 'EXACT_MATCH',
      proposedProductId: 'product-1',
    },
    baseline: {
      currency: 'COP',
      currentCost: 12000,
      currentSalePrice: 20000,
      supplierLastCost: null,
      previousObservedUnitCost: 12000,
    },
    createdAt: '2026-09-03T12:01:00.000Z',
  };
}

describe('GAP-021 Supplier Price Evidence', () => {
  it('prepares supplier observations as evidence without authorizing mutations', () => {
    const result = prepareSupplierPriceEvidence(baseInput());

    expect(result.evidence).toHaveLength(2);
    expect(result.canonicalProductId).toBe('product-1');
    expect(result.candidateProductId).toBeNull();
    expect(result.requiresHumanReview).toBe(false);
    expect(result.candidate?.type).toBe('PRICE_REVIEW');
    expect(result.recommendation).toBeNull();
    expect(result.canAutoUpdateSalePrice).toBe(false);
    expect(result.canAutoWriteCostHistory).toBe(false);
    expect(result.canAutoUpdateSupplierLastCost).toBe(false);
    expect(result.evidence.every((entry) => entry.sourceAuthority.level === 'SUPPLIER')).toBe(true);
  });

  it('never converts a fuzzy reconciliation into a canonical product price association', () => {
    const input = baseInput();
    const result = prepareSupplierPriceEvidence({
      ...input,
      reconciliation: {
        classification: 'POSSIBLE_MATCH',
        proposedProductId: 'possible-product-2',
      },
    });

    expect(result.canonicalProductId).toBeNull();
    expect(result.candidateProductId).toBe('possible-product-2');
    expect(result.requiresHumanReview).toBe(true);
    expect(result.recommendation?.actionType).toBe('REVIEW_SUPPLIER_PRICE_EVIDENCE');
    expect(result.recommendation?.risk.level).toBe('R2');
  });

  it('keeps ambiguous/conflicting identities detached from Product Master', () => {
    for (const classification of ['REVIEW_REQUIRED', 'CONFLICT'] as const) {
      const input = baseInput();
      const result = prepareSupplierPriceEvidence({
        ...input,
        reconciliation: {
          classification,
          proposedProductId: null,
        },
      });
      expect(result.canonicalProductId).toBeNull();
      expect(result.candidateProductId).toBeNull();
      expect(result.requiresHumanReview).toBe(true);
    }
  });

  it('detects supplier unit-cost change against previous source observation first', () => {
    const input = baseInput();
    const result = prepareSupplierPriceEvidence({
      ...input,
      observation: { ...input.observation, unitCost: 15000, suggestedSalePrice: null },
      baseline: {
        ...input.baseline,
        currentCost: 10000,
        supplierLastCost: 11000,
        previousObservedUnitCost: 12000,
      },
    });

    expect(result.costReferenceAmount).toBe(12000);
    expect(result.unitCostDelta).toBe(3000);
    expect(result.requiresHumanReview).toBe(true);
    expect(result.recommendation?.priority).toBe('P1');
  });

  it('treats supplier suggested sale price as non-authoritative review evidence', () => {
    const input = baseInput();
    const result = prepareSupplierPriceEvidence({
      ...input,
      observation: { ...input.observation, unitCost: null, suggestedSalePrice: 25000 },
    });

    expect(result.suggestedSalePriceDelta).toBe(5000);
    expect(result.requiresHumanReview).toBe(true);
    expect(result.candidate?.payload).toMatchObject({
      supplierSuggestedSalePriceIsNonAuthoritative: true,
      canAutoUpdateSalePrice: false,
    });
    expect(result.recommendation?.rationale.join(' ')).toContain('PRODUCT_PRICE_CHANGE');
  });

  it('returns no candidate or recommendation when the source record contains no pricing observation', () => {
    const input = baseInput();
    const result = prepareSupplierPriceEvidence({
      ...input,
      observation: {
        ...input.observation,
        unitCost: null,
        suggestedSalePrice: null,
      },
    });

    expect(result.evidence).toEqual([]);
    expect(result.candidate).toBeNull();
    expect(result.recommendation).toBeNull();
    expect(result.requiresHumanReview).toBe(false);
  });

  it('rejects negative observed amounts and invalid confidence', () => {
    const input = baseInput();
    expect(() =>
      prepareSupplierPriceEvidence({
        ...input,
        observation: { ...input.observation, unitCost: -1 },
      }),
    ).toThrow('SUPPLIER_PRICE_UNIT_COST_INVALID');

    expect(() =>
      prepareSupplierPriceEvidence({
        ...input,
        observation: { ...input.observation, extractionConfidence: 1.1 },
      }),
    ).toThrow('SUPPLIER_PRICE_EVIDENCE_CONFIDENCE_INVALID');
  });

  it('uses deterministic evidence fingerprints for the same supplier observation', () => {
    const first = prepareSupplierPriceEvidence(baseInput());
    const second = prepareSupplierPriceEvidence(baseInput());
    expect(first.evidence.map((entry) => entry.fingerprint)).toEqual(
      second.evidence.map((entry) => entry.fingerprint),
    );
  });
});
