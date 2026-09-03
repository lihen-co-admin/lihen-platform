import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const capabilityPath = path.join(
  root,
  'packages/intelligence-core/src/capabilities/document-intelligence.ts',
);
const indexPath = path.join(root, 'packages/intelligence-core/src/index.ts');

describe('GAP-019 Document Intelligence architecture', () => {
  it('keeps the capability inside intelligence-core and exported from the package', () => {
    expect(fs.existsSync(capabilityPath)).toBe(true);
    const indexSource = fs.readFileSync(indexPath, 'utf8');
    expect(indexSource).toContain(
      "export * from './capabilities/document-intelligence';",
    );
  });

  it('does not couple Document Intelligence to Supabase, database, React or controlled RPC execution', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).not.toMatch(/from ['"]@supabase\//);
    expect(source).not.toMatch(/from ['"]@lihen\/database/);
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(source).not.toMatch(/\.(rpc|from)\s*\(/);
    expect(source).not.toMatch(/createClient\s*\(/);
  });

  it('reuses provider-neutral extraction and preserves downstream gap boundaries', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).toContain('DocumentExtractionPort');
    expect(source).toContain('VisionPort');
    expect(source).toContain('SearchPort');
    expect(source).toContain("capability: 'DOCUMENT_INTELLIGENCE'");
    expect(source).not.toContain("type: 'NEW_PRODUCT'");
    expect(source).not.toContain('matchedProductId');
    expect(source).not.toContain('salePriceMutation');
  });

  it('does not create a second review or command engine', () => {
    const source = fs.readFileSync(capabilityPath, 'utf8');
    expect(source).not.toContain('class ReviewQueue');
    expect(source).not.toContain('class CommandEngine');
    expect(source).not.toContain('executeControlledCommand');
  });
});
