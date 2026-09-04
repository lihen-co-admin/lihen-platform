import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const capabilityPath =
  'packages/intelligence-core/src/capabilities/orders-sales-intelligence.ts';
const indexPath = 'packages/intelligence-core/src/index.ts';
const docPath =
  'docs/architecture/WAVE8_GAP029_ORDERS_SALES_INTELLIGENCE.md';

describe('WAVE 8 / GAP-029 Orders & Sales Intelligence architecture', () => {
  const source = readFileSync(capabilityPath, 'utf8');
  const index = readFileSync(indexPath, 'utf8');
  const doc = readFileSync(docPath, 'utf8');

  it('exports the capability from intelligence-core', () => {
    expect(index).toContain(
      "export * from './capabilities/orders-sales-intelligence';",
    );
  });

  it('remains provider and persistence neutral', () => {
    expect(source).not.toMatch(/from ['"]@supabase\//);
    expect(source).not.toMatch(/from ['"]@lihen\/database/);
    expect(source).not.toMatch(/from ['"]react/);
    expect(source).not.toMatch(/\.rpc\s*\(/);
    expect(source).not.toMatch(/\.from\s*\(/);
    expect(source).not.toMatch(/createClient\s*\(/);
  });

  it('does not absorb transactional domain packages or controlled execution', () => {
    expect(source).not.toMatch(/from ['"]@lihen\/orders/);
    expect(source).not.toMatch(/from ['"]@lihen\/sales/);
    expect(source).not.toMatch(/from ['"]@lihen\/inventory/);
    expect(source).not.toMatch(/from ['"]@lihen\/finance/);
    expect(source).not.toMatch(/create_order_draft_controlled/);
    expect(source).not.toMatch(/confirm_order_controlled/);
    expect(source).not.toMatch(/cancel_order_controlled/);
    expect(source).not.toMatch(/create_pos_sale_controlled/);
    expect(source).not.toMatch(/complete_order_sale_controlled/);
  });

  it('keeps every governed mutation capability explicitly disabled', () => {
    expect(source).toContain('readonly canAutoCreateOrder: false;');
    expect(source).toContain('readonly canAutoConfirmOrder: false;');
    expect(source).toContain('readonly canAutoCancelOrder: false;');
    expect(source).toContain('readonly canAutoCompleteSale: false;');
    expect(source).toContain('readonly canAutoReverseSale: false;');
    expect(source).toContain('readonly canAutoMoveInventory: false;');
    expect(source).toContain('readonly canAutoPostFinance: false;');
  });

  it('documents the reuse boundary and GAP-030 separation', () => {
    expect(doc).toContain('REUSE + EXTEND / CONSOLIDATE');
    expect(doc).toContain('Existing Control Plane');
    expect(doc).toContain('GAP-030');
    expect(doc).toContain('NO THIRD FINANCE LEDGER');
  });
});
