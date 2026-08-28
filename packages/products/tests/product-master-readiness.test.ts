import { describe, expect, it } from 'vitest';
import { evaluateProductMasterReadiness } from '../src';

describe('Product Master readiness', () => {
  it('marks complete active canonical identity as READY and OFFERABLE', () => {
    expect(evaluateProductMasterReadiness({
      businessLine: 'BEAUTY_CARE',
      brandId: 'brand-1',
      brandStatus: 'ACTIVE',
      categoryId: 'category-1',
      categoryStatus: 'ACTIVE',
      categoryBusinessLine: 'BEAUTY_CARE',
      status: 'ACTIVE',
    })).toEqual({ identityStatus: 'READY', lifecycleStatus: 'OFFERABLE', issues: [] });
  });

  it('reports missing canonical taxonomy without inventing it', () => {
    const result = evaluateProductMasterReadiness({
      businessLine: 'STYLE',
      status: 'INACTIVE',
    });
    expect(result.identityStatus).toBe('INCOMPLETE');
    expect(result.lifecycleStatus).toBe('NOT_OFFERABLE');
    expect(result.issues).toEqual(['BRAND_REQUIRED', 'CATEGORY_REQUIRED']);
  });

  it('reports inactive taxonomy as incomplete but keeps the identity traceable', () => {
    const result = evaluateProductMasterReadiness({
      businessLine: 'BEAUTY_CARE',
      brandId: 'brand-1',
      brandStatus: 'INACTIVE',
      categoryId: 'category-1',
      categoryStatus: 'INACTIVE',
      categoryBusinessLine: 'BEAUTY_CARE',
      status: 'ARCHIVED',
    });
    expect(result.identityStatus).toBe('INCOMPLETE');
    expect(result.issues).toEqual(['BRAND_INACTIVE', 'CATEGORY_INACTIVE']);
    expect(result.lifecycleStatus).toBe('NOT_OFFERABLE');
  });

  it('treats category/business-line mismatch as invalid canonical identity', () => {
    const result = evaluateProductMasterReadiness({
      businessLine: 'STYLE',
      brandId: 'brand-1',
      brandStatus: 'ACTIVE',
      categoryId: 'category-beauty',
      categoryStatus: 'ACTIVE',
      categoryBusinessLine: 'BEAUTY_CARE',
      status: 'ACTIVE',
    });
    expect(result.identityStatus).toBe('INVALID');
    expect(result.issues).toContain('CATEGORY_BUSINESS_LINE_MISMATCH');
  });

  it('does not equate master readiness with publication readiness', () => {
    const result = evaluateProductMasterReadiness({
      businessLine: 'STYLE',
      brandId: 'brand-1',
      brandStatus: 'ACTIVE',
      categoryId: 'category-style',
      categoryStatus: 'ACTIVE',
      categoryBusinessLine: 'STYLE',
      status: 'INACTIVE',
    });
    expect(result.identityStatus).toBe('READY');
    expect(result.lifecycleStatus).toBe('NOT_OFFERABLE');
  });
});
