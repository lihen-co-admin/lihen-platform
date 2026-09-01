import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const source = () =>
  readFileSync(
    join(root, 'packages/intelligence-core/src/review-queue.ts'),
    'utf8',
  );

describe('WAVE 3 / GAP-010 Unified Human Review Queue architecture', () => {
  it('is a pure read/review model with no React, Supabase, database or RPC dependency', () => {
    const value = source();

    expect(value).not.toMatch(/react|@supabase\/|@lihen\/database/i);
    expect(value).not.toMatch(/\.rpc\s*\(|\.from\s*\(|\.insert\s*\(|\.update\s*\(/);
  });

  it('does not define a second persistence or command engine', () => {
    const value = source();

    expect(value).not.toMatch(/class\s+.*Repository|saveDecision|persistDecision|executeCommand/i);
    expect(value).not.toMatch(/controlled.*rpc|operationIntent|confirmationToken/i);
  });

  it('keeps source-specific authority visible', () => {
    const value = source();

    for (const sourceKind of [
      'INTELLIGENCE_RECOMMENDATION',
      'PRODUCT_RECONCILIATION',
      'VISUAL_INTELLIGENCE',
      'SUPPLIER_CANDIDATE',
      'GOVERNANCE',
    ]) {
      expect(value).toContain(sourceKind);
    }
  });

  it('reuses IntelligenceRecommendation and IntelligenceDecision contracts', () => {
    const value = source();

    expect(value).toContain('IntelligenceRecommendation');
    expect(value).toContain('IntelligenceDecision');
    expect(value).toContain("from './contracts'");
  });

  it('does not authorize execution or publish from queue state', () => {
    const value = source();

    expect(value).not.toMatch(/execute\s*\(|publish\s*\(|approveAndExecute/i);
    expect(value).toContain('REVIEW_ITEM_EXECUTION_AUTHORITY_FORBIDDEN');
  });

  it('does not implement UI or social APIs', () => {
    const value = source();

    expect(value).not.toMatch(/jsx|tsx|instagram|facebook|tiktok|youtube/i);
  });
});
