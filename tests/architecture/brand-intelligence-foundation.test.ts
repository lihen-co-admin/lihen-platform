import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const capabilityPath = path.join(
  root,
  'packages/intelligence-core/src/capabilities/brand-intelligence.ts',
);
const indexPath = path.join(root, 'packages/intelligence-core/src/index.ts');
const source = fs.readFileSync(capabilityPath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');

describe('WAVE 5 / GAP-016 Brand Intelligence architecture', () => {
  it('keeps Brand Intelligence behind the Intelligence capability boundary', () => {
    expect(source).toContain("capability: 'BRAND_INTELLIGENCE'");
    expect(source).toContain("type: 'BRAND'");
    expect(source).toContain("type: 'BRAND_ASSET'");
  });

  it('reuses provider-neutral Search and Vision ports', () => {
    expect(source).toContain("from '../provider-ports'");
    expect(source).toContain('readonly search: SearchPort');
    expect(source).toContain('readonly vision: VisionPort');
  });

  it('does not couple the capability to React, Supabase, database, SQL or RPC clients', () => {
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(source).not.toMatch(/@supabase\//);
    expect(source).not.toMatch(/@lihen\/database/);
    expect(source).not.toMatch(/\.rpc\s*\(/);
    expect(source).not.toMatch(/createClient\s*\(/);
  });

  it('keeps canonical mutation outside Brand Intelligence', () => {
    expect(source).toContain(
      'Confidence is evidence quality, not authorization.',
    );
    expect(source).toContain('requiresHumanReview');
    expect(source).not.toMatch(/update\s*\(\s*['"]brands/i);
    expect(source).not.toMatch(/insert\s*\(\s*['"]brands/i);
  });

  it('protects manual verified identity explicitly', () => {
    expect(source).toContain("'MANUAL_VERIFIED'");
    expect(source).toContain("'MANUAL_IDENTITY_PROTECTED'");
    expect(source).toContain('REVIEW_MANUAL_BRAND_ASSET_REPLACEMENT');
  });

  it('exports the capability from intelligence-core', () => {
    expect(indexSource).toContain(
      "export * from './capabilities/brand-intelligence';",
    );
  });
});
