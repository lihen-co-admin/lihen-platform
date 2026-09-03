import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const composerPath = path.join(
  root,
  'packages/catalog/src/application/catalog-composer.ts',
);
const indexPath = path.join(root, 'packages/catalog/src/index.ts');
const rendererPath = path.join(
  root,
  'apps/control-center/src/pages/CatalogPdfRenderPage.tsx',
);

describe('GAP-023 Catalog Composer architecture', () => {
  it('extracts Catalog Composer into @lihen/catalog and exports it', () => {
    expect(fs.existsSync(composerPath)).toBe(true);
    const indexSource = fs.readFileSync(indexPath, 'utf8');
    expect(indexSource).toContain(
      "export * from './application/catalog-composer';",
    );
  });

  it('reuses CatalogRenderModelVNext instead of creating a second render contract', () => {
    const source = fs.readFileSync(composerPath, 'utf8');
    expect(source).toContain('createCatalogRenderModelVNext');
    expect(source).toContain('CatalogRenderModelVNext');
    expect(source).not.toContain('class CatalogRenderModel');
  });

  it('keeps the Composer pure and detached from Supabase, RPC and React', () => {
    const source = fs.readFileSync(composerPath, 'utf8');
    expect(source).not.toMatch(/from ['"]@supabase\//);
    expect(source).not.toMatch(/from ['"]@lihen\/database/);
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(source).not.toMatch(/\.(rpc|from)\s*\(/);
    expect(source).not.toMatch(/createClient\s*\(/);
    expect(source).not.toContain('window.print');
  });

  it('does not absorb PDF layout, STYLE editorial policy, integrity guard or publishing', () => {
    const source = fs.readFileSync(composerPath, 'utf8');
    expect(source).not.toContain('PRODUCTS_PER_PAGE');
    expect(source).not.toContain('buildBodyPages');
    expect(source).not.toContain('buildStyleBodyPages');
    expect(source).not.toContain('STYLE_VISUAL_FOUNDATION');
    expect(source).not.toContain('canPrint');
    expect(source).not.toContain('registerCatalogPdfArtifact');
  });

  it('preserves migration boundaries instead of promoting legacy media to canonical authority', () => {
    const source = fs.readFileSync(composerPath, 'utf8');
    expect(source).toContain("'CHANNEL_SELECTION'");
    expect(source).toContain("'LEGACY_RENDER_PROJECTION'");
    expect(source).toContain("'CANONICAL_BRAND_ASSET'");
    expect(source).toContain("'LEGACY_COMPATIBILITY'");
    expect(source).toContain("'TEXT_ONLY'");
  });

  it('leaves the current renderer untouched for GAP-024 purification', () => {
    expect(fs.existsSync(rendererPath)).toBe(true);
    const rendererSource = fs.readFileSync(rendererPath, 'utf8');
    expect(rendererSource).toContain('CatalogPdfRenderPage');
    expect(rendererSource).toContain('buildBodyPages');
  });
});
