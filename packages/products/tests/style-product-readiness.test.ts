import { describe, expect, it } from 'vitest';
import { evaluateStyleProductReadiness } from '../src';

describe('F5-S1 Style product readiness', () => {
  it('marks a complete but still hidden Style product READY', () => {
    expect(evaluateStyleProductReadiness({ active:true, visibleOnWebsite:false, sku:'ST-001', salePrice:45000, brandId:'brand', categoryId:'category', hasExactApprovedImage:true })).toEqual({ status:'READY', blockingReasons:[], visibilityMustRemainOff:true });
  });
  it('keeps incomplete Style products blocked with explicit reasons', () => {
    const result=evaluateStyleProductReadiness({ active:true, visibleOnWebsite:false, salePrice:45000, hasExactApprovedImage:false });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockingReasons).toEqual(expect.arrayContaining(['SKU_REQUIRED','BRAND_REQUIRED','CATEGORY_REQUIRED','EXACT_APPROVED_IMAGE_REQUIRED']));
  });
  it('treats premature visibility as a blocker during S1', () => {
    const result=evaluateStyleProductReadiness({ active:true, visibleOnWebsite:true, sku:'ST-001', salePrice:45000, brandId:'brand', categoryId:'category', hasExactApprovedImage:true });
    expect(result.blockingReasons).toContain('PREMATURE_VISIBILITY');
  });
});
