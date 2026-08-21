import { describe, expect, it } from 'vitest';
import { assessProductImportCandidate } from '../src/domain/product-import-candidate';

describe('product import candidate assessment', () => {
  it('prepares a unique catalog reference with canonical taxonomy', () => {
    expect(assessProductImportCandidate({ referenceId:'A', businessLine:'BEAUTY_CARE', name:'Producto', brandId:'brand-1' })).toMatchObject({
      businessLine:'BEAUTY_CARE', status:'READY_CANDIDATE', proposedAction:'CREATE_PRODUCT', taxonomyAnchored:true, autoInsertAllowed:false,
    });
  });
  it('holds duplicate identity for review', () => {
    expect(assessProductImportCandidate({ referenceId:'B', businessLine:'BEAUTY_CARE', name:'Producto', categoryId:'cat-1', duplicateIdentity:true })).toMatchObject({
      status:'CONFLICT', proposedAction:'HOLD_FOR_REVIEW', autoInsertAllowed:false,
    });
  });
  it('never accepts a candidate without a canonical taxonomy anchor', () => {
    expect(assessProductImportCandidate({ referenceId:'C', businessLine:'STYLE', name:'Producto' })).toMatchObject({
      businessLine:'STYLE', status:'REVIEW_REQUIRED', taxonomyAnchored:false, autoInsertAllowed:false,
    });
  });
});
