import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const capabilityPath = path.join(
  repoRoot,
  'packages/intelligence-core/src/capabilities/procurement-intelligence.ts',
);
const indexPath = path.join(repoRoot, 'packages/intelligence-core/src/index.ts');

describe('WAVE 8 / GAP-028 Procurement Intelligence architecture', () => {
  it('keeps Procurement Intelligence inside the shared Intelligence Core', () => {
    expect(fs.existsSync(capabilityPath)).toBe(true);
    const index = fs.readFileSync(indexPath, 'utf8');
    expect(index).toContain("export * from './capabilities/procurement-intelligence';");
  });

  it('remains provider, UI, database and domain-package neutral', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(source).not.toMatch(/@supabase\//);
    expect(source).not.toMatch(/@lihen\/database/);
    expect(source).not.toMatch(/@lihen\/procurement/);
    expect(source).not.toMatch(/@lihen\/inventory/);
    expect(source).not.toMatch(/createClient\s*\(/);
    expect(source).not.toMatch(/\.rpc\s*\(/);
  });

  it('uses governed PURCHASE context and ANALYTICS capability semantics', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).toContain("type: 'PURCHASE'");
    expect(source).toContain("capability: 'ANALYTICS'");
    expect(source).toContain('LIHEN Procurement Read Model');
  });

  it('does not invent supplier history or receipt-cost comparisons', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).toContain('supplierPerformance');
    expect(source).toContain('hasCostComparison');
    expect(source).toContain('supplier performance patterns are not inferred from one purchase');
    expect(source).toContain('cost change is not invented');
  });

  it('keeps all operational and financial execution held', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).toContain('canAutoConfirmPurchase: false');
    expect(source).toContain('canAutoReceivePurchase: false');
    expect(source).toContain('canAutoPostInventory: false');
    expect(source).toContain('canAutoPostFinance: false');
    expect(source).toContain('canAutoChangeSupplierCost: false');
  });

  it('does not duplicate Purchase readiness, inventory ledger, or supplier document ingestion', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).not.toContain('evaluatePurchaseSupplyReadiness');
    expect(source).not.toContain('reconcilePurchaseWithInventory');
    expect(source).not.toContain('register_supplier_source_document_controlled');
    expect(source).not.toContain('ingest_supplier_source_records_controlled');
    expect(source).not.toContain('receive_purchase_controlled');
  });
});
