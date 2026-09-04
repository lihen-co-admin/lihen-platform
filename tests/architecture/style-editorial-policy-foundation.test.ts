import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), 'utf8');

describe('GAP-026 STYLE Editorial Policy architecture', () => {
  it('makes STYLE consume CatalogRenderProductSnapshot instead of CatalogRenderEntry', () => {
    const templates = read(
      'apps/control-center/src/composition/catalog-style-templates.ts',
    );
    const sheets = read(
      'apps/control-center/src/components/CatalogStyleSheets.tsx',
    );
    const productVisual = read(
      'apps/control-center/src/composition/catalog-style-product-visual.ts',
    );

    expect(templates).toContain('CatalogRenderProductSnapshot');
    expect(sheets).toContain('CatalogRenderProductSnapshot');
    expect(productVisual).toContain('CatalogRenderProductSnapshot');
    expect(templates).not.toContain("from './catalogs'");
    expect(sheets).not.toContain("from '../composition/catalogs'");
    expect(productVisual).not.toContain("from './catalogs'");
  });

  it('retires the GAP-024 legacy STYLE adapter from production rendering', () => {
    const renderer = read(
      'apps/control-center/src/pages/CatalogPdfRenderPage.tsx',
    );
    const composition = read(
      'apps/control-center/src/composition/catalog-pdf-render-model.ts',
    );

    expect(renderer).not.toContain('toLegacyStyleRenderEntry');
    expect(composition).not.toContain('toLegacyStyleRenderEntry');
    expect(renderer).toContain('buildStyleBodyPages(styleRenderEntries)');
  });

  it('formalizes editorial asset as presentation-only and non-canonical', () => {
    const policy = read(
      'apps/control-center/src/composition/catalog-style-editorial-policy.ts',
    );
    const productVisual = read(
      'apps/control-center/src/composition/catalog-style-product-visual.ts',
    );

    expect(policy).toContain("role: 'EDITORIAL_PRESENTATION'");
    expect(policy).toContain('canonicalAuthority: false');
    expect(policy).toContain('productAssetMutationAllowed: false');
    expect(policy).toContain('selectedPdfAssetReplacementAllowed: false');
    expect(productVisual).toContain('resolveStyleEditorialAsset');
  });

  it('keeps DEV preview explicit, non-publishable and outside canonical authority', () => {
    const preview = read(
      'apps/control-center/src/composition/catalog-style-commercial-preview.ts',
    );

    expect(preview).toContain("mode: 'DEV_ONLY'");
    expect(preview).toContain('publicationAllowed: false');
    expect(preview).toContain('snapshotMutationAllowed: false');
    expect(preview).toContain("resolutionSource: 'LEGACY_RENDER_PROJECTION'");
    expect(preview).toContain('CatalogRenderProductSnapshot');
  });

  it('keeps STYLE editorial policy free of persistence and infrastructure writes', () => {
    const policy = read(
      'apps/control-center/src/composition/catalog-style-editorial-policy.ts',
    );

    expect(policy).not.toMatch(/@supabase|@lihen\/database/);
    expect(policy).not.toContain('.rpc(');
    expect(policy).not.toContain('.insert(');
    expect(policy).not.toContain('.update(');
    expect(policy).not.toContain('window.print');
  });
});
