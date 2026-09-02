import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const domainPath = resolve(
  root,
  'packages/products/src/domain/brand-asset.ts',
);
const brandPath = resolve(root, 'packages/products/src/domain/brand.ts');
const indexPath = resolve(root, 'packages/products/src/index.ts');

describe('WAVE 5 / GAP-015 Brand Asset Domain architecture', () => {
  const source = readFileSync(domainPath, 'utf8');
  const brandSource = readFileSync(brandPath, 'utf8');
  const indexSource = readFileSync(indexPath, 'utf8');

  it('lives in @lihen/products beside the existing Brand Master', () => {
    expect(brandSource).toContain('export class Brand');
    expect(source).toContain('export class BrandAsset');
    expect(source).toContain('export class BrandAssetSet');
  });

  it('formalizes canonical visual identity kinds without renderer coupling', () => {
    expect(source).toContain("'LOGO'");
    expect(source).toContain("'WORDMARK'");
    expect(source).toContain("'ISOTYPE'");
    expect(source).toContain("'LOCKUP'");

    expect(source).not.toMatch(/from\s+['"]react['"]/i);
    expect(source).not.toMatch(/CatalogPdfRenderPage/);
    expect(source).not.toMatch(/from\s+['"][^'"]*renderer[^'"]*['"]/i);
    expect(source).not.toMatch(/import\s+[^;]*renderer/i);
  });

  it('keeps manual verification representable without implementing auto replacement', () => {
    expect(source).toContain("'MANUAL_VERIFIED'");
    expect(source).toContain("'AUTO_VERIFIED'");
    expect(source).toContain("'CANDIDATE'");
    expect(source).toContain("'REQUIRES_REVIEW'");
    expect(source).not.toMatch(
      /replaceManualVerified\s*\(|autoReplaceBrandAsset\s*\(|approveCandidate\s*\(/i,
    );
  });

  it('does not couple the pure domain to Supabase, SQL, RPC or application UI', () => {
    expect(source).not.toMatch(/@supabase|from\(['"]brands['"]\)|\.rpc\s*\(|createClient|apps\/control-center/i);
  });

  it('does not create Brand Intelligence responsibilities inside GAP-015', () => {
    expect(source).not.toMatch(
      /searchOfficialBrand|visionProvider|searchProvider|verifyBrandIdentity|generateBrandAsset/i,
    );
  });

  it('exports the Brand Asset foundation from @lihen/products', () => {
    expect(indexSource).toContain("export * from './domain/brand-asset';");
  });
});
