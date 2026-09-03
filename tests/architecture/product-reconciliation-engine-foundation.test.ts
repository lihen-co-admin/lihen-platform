import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const capabilityPath = path.join(
  root,
  'packages/intelligence-core/src/capabilities/product-reconciliation.ts',
);
const indexPath = path.join(root, 'packages/intelligence-core/src/index.ts');
const reviewQueuePath = path.join(
  root,
  'packages/intelligence-core/src/review-queue.ts',
);

describe('GAP-020 Product Reconciliation architecture', () => {
  it('keeps reconciliation policy in intelligence-core and exported from the package', () => {
    expect(fs.existsSync(capabilityPath)).toBe(true);
    const indexSource = fs.readFileSync(indexPath, 'utf8');
    expect(indexSource).toContain(
      "export * from './capabilities/product-reconciliation';",
    );
  });

  it('reuses the existing Unified Human Review Queue projection', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    const queueSource = fs.readFileSync(reviewQueuePath, 'utf8');
    expect(source).toContain('ReconciliationReviewCandidateInput');
    expect(queueSource).toContain("'PRODUCT_RECONCILIATION'");
    expect(queueSource).toContain('reviewItemFromReconciliation');
    expect(source).not.toContain('class ReviewQueue');
  });

  it('forbids direct persistence, Supabase, RPC, React and command execution', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).not.toMatch(/from ['"]@supabase\//);
    expect(source).not.toMatch(/from ['"]@lihen\/database/);
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(source).not.toMatch(/\.(rpc|from)\s*\(/);
    expect(source).not.toMatch(/createClient\s*\(/);
    expect(source).not.toContain('executeControlledCommand');
    expect(source).not.toContain('class CommandEngine');
  });

  it('freezes the no-auto-assignment and no-auto-create invariants', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).toContain('canAutoAssignProductId: false');
    expect(source).toContain('canAutoCreateProductMaster: false');
    expect(source).toContain('Fuzzy reconciliation never autoassigns product_id.');
    expect(source).toContain('Existing Control Plane is required');
  });

  it('does not create a parallel persistence model or source-specific decision store', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).not.toContain('product_master_reconciliation_runs');
    expect(source).not.toContain('product_master_reconciliation_results');
    expect(source).not.toContain('product_master_reconciliation_decisions');
    expect(source).not.toContain('supplier_candidate_bridge_results');
    expect(source).toContain(
      "'EXISTING_PRODUCT_RECONCILIATION_DECISIONS'",
    );
  });
});
