import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const capabilityPath = path.join(
  root,
  'packages/intelligence-core/src/capabilities/supplier-price-evidence.ts',
);
const indexPath = path.join(root, 'packages/intelligence-core/src/index.ts');
const reviewQueuePath = path.join(root, 'packages/intelligence-core/src/review-queue.ts');

describe('GAP-021 Supplier Price Evidence architecture', () => {
  it('keeps supplier price evidence in intelligence-core and exported from the package', () => {
    expect(fs.existsSync(capabilityPath)).toBe(true);
    const indexSource = fs.readFileSync(indexPath, 'utf8');
    expect(indexSource).toContain("export * from './capabilities/supplier-price-evidence';");
  });

  it('reuses PRICE_REVIEW and the existing recommendation-based Human Review Queue', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    const queueSource = fs.readFileSync(reviewQueuePath, 'utf8');
    expect(source).toContain("type: 'PRICE_REVIEW'");
    expect(source).toContain("actionType: 'REVIEW_SUPPLIER_PRICE_EVIDENCE'");
    expect(queueSource).toContain('reviewItemFromRecommendation');
    expect(source).not.toContain('class ReviewQueue');
  });

  it('freezes supplier pricing as evidence and forbids automatic sale-price/cost mutations', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).toContain('canAutoUpdateSalePrice: false');
    expect(source).toContain('canAutoWriteCostHistory: false');
    expect(source).toContain('canAutoUpdateSupplierLastCost: false');
    expect(source).toContain('supplierSuggestedSalePriceIsNonAuthoritative: true');
    expect(source).toContain('Human Decision + Existing Control Plane + PRODUCT_PRICE_CHANGE');
  });

  it('keeps fuzzy reconciliation detached from canonical Product Master association', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).toContain("ref.classification !== 'EXACT_MATCH'");
    expect(source).toContain("ref.classification !== 'POSSIBLE_MATCH'");
  });

  it('forbids direct persistence, Supabase/RPC, React and parallel pricing infrastructure', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).not.toMatch(/from ['"]@supabase\//);
    expect(source).not.toMatch(/from ['"]@lihen\/database/);
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(source).not.toMatch(/\.(rpc|from)\s*\(/);
    expect(source).not.toMatch(/createClient\s*\(/);
    expect(source).not.toContain('product_cost_history');
    expect(source).not.toContain('product_sale_price_history');
    expect(source).not.toContain('supplier_products');
    expect(source).not.toContain('class PricingEngine');
  });
});
