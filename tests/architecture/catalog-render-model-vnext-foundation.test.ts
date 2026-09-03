import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const modelPath = path.join(
  root,
  'packages/catalog/src/domain/catalog-render-model-vnext.ts',
);
const indexPath = path.join(root, 'packages/catalog/src/index.ts');
const rendererPath = path.join(
  root,
  'apps/control-center/src/pages/CatalogPdfRenderPage.tsx',
);

describe('GAP-022 Catalog Render Model VNext architecture', () => {
  it('places the renderer-ready contract in @lihen/catalog and exports it', () => {
    expect(fs.existsSync(modelPath)).toBe(true);
    const indexSource = fs.readFileSync(indexPath, 'utf8');
    expect(indexSource).toContain(
      "export * from './domain/catalog-render-model-vnext';",
    );
  });

  it('keeps the Render Model pure and detached from UI, Supabase and RPC', () => {
    const source = fs.readFileSync(modelPath, 'utf8');
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(source).not.toMatch(/from ['"]@supabase\//);
    expect(source).not.toMatch(/from ['"]@lihen\/database/);
    expect(source).not.toMatch(/\.(rpc|from)\s*\(/);
    expect(source).not.toMatch(/createClient\s*\(/);
    expect(source).not.toContain('window.print');
  });

  it('does not absorb Catalog Composer, renderer, integrity guard or STYLE editorial policy', () => {
    const source = fs.readFileSync(modelPath, 'utf8');
    expect(source).not.toContain('buildBodyPages');
    expect(source).not.toContain('PRODUCTS_PER_PAGE');
    expect(source).not.toContain('STYLE_VISUAL_FOUNDATION');
    expect(source).not.toContain('buildStyleBodyPages');
    expect(source).not.toContain('canPrint');
  });

  it('represents resolved PDF asset and brand visual provenance without choosing them', () => {
    const source = fs.readFileSync(modelPath, 'utf8');
    expect(source).toContain("'CHANNEL_SELECTION'");
    expect(source).toContain("'LEGACY_RENDER_PROJECTION'");
    expect(source).toContain("'CANONICAL_BRAND_ASSET'");
    expect(source).toContain("'LEGACY_COMPATIBILITY'");
    expect(source).toContain('selectedPdfAsset');
    expect(source).toContain('resolutionSource');
  });

  it('does not modify the existing renderer as part of the GAP-022 contract', () => {
    expect(fs.existsSync(rendererPath)).toBe(true);
    const renderer = fs.readFileSync(rendererPath, 'utf8');
    expect(renderer).toContain('type CatalogRenderEntry');
    expect(renderer).toContain('buildBodyPages');
  });
});
