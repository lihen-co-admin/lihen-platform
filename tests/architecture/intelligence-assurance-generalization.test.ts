import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

describe('Intelligence Assurance architecture — GAP-005', () => {
  it('keeps the generic assurance engine inside intelligence-core', () => {
    const source = readFileSync(
      join(root, 'packages/intelligence-core/src/assurance.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/react|@supabase\/|@lihen\/database/);
    expect(source).not.toMatch(/\.rpc\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(/);
  });

  it('does not recalculate priority, risk, permission, or controlled execution', () => {
    const source = readFileSync(
      join(root, 'packages/intelligence-core/src/assurance.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/PRIORITY_ORDER|evaluatePermission|ControlledCommand|riskLevel/);
  });

  it('turns the existing Control Center assurance file into a compatibility adapter', () => {
    const source = readFileSync(
      join(root, 'apps/control-center/src/domain/intelligence-assurance.ts'),
      'utf8',
    );

    expect(source).toContain("from '@lihen/intelligence-core'");
    expect(source).toContain('evaluateRecommendationAssurance');
    expect(source).toContain("recommendation.id === 'execution-held'");
  });

  it('keeps the core free from the legacy execution-held identifier', () => {
    const source = readFileSync(
      join(root, 'packages/intelligence-core/src/assurance.ts'),
      'utf8',
    );

    expect(source).not.toContain('execution-held');
  });
});
