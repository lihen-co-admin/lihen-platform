import { describe, expect, it } from 'vitest';
import {
  validateCandidateDecision,
  validateIdentityResolution,
} from '../src/domain/product-candidate-review-resolution';

describe('product candidate review resolution', () => {
  it('requires selectedProductId only for LINK_EXISTING_PRODUCT', () => {
    expect(() => validateCandidateDecision({ decision: 'LINK_EXISTING_PRODUCT', selectedProductId: null, reason: 'match' })).toThrow('LIHEN_SELECTED_PRODUCT_DECISION_MISMATCH');
    expect(() => validateCandidateDecision({ decision: 'APPROVE_CREATE', selectedProductId: 'x', reason: 'new' })).toThrow('LIHEN_SELECTED_PRODUCT_DECISION_MISMATCH');
  });

  it('rejects identity resolution for singleton groups', () => {
    expect(() => validateIdentityResolution({ resolution: 'DISTINCT_PRODUCTS', canonicalSourceReferenceId: null, memberCount: 1, reason: 'single' })).toThrow('LIHEN_IDENTITY_GROUP_REQUIRES_MULTIPLE_MEMBERS');
  });

  it('requires canonical source only for duplicate references', () => {
    expect(() => validateIdentityResolution({ resolution: 'DUPLICATE_REFERENCE', canonicalSourceReferenceId: null, memberCount: 2, reason: 'duplicate' })).toThrow('LIHEN_CANONICAL_REFERENCE_RESOLUTION_MISMATCH');
  });
});
