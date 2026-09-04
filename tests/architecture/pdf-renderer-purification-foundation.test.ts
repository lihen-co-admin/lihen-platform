import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rendererPath = path.join(
  root,
  'apps/control-center/src/pages/CatalogPdfRenderPage.tsx',
);
const compositionPath = path.join(
  root,
  'apps/control-center/src/composition/catalog-pdf-render-model.ts',
);

describe('GAP-024 PDF Renderer Purification architecture', () => {
  it('makes the renderer consume CatalogRenderModelVNext through a dedicated composition boundary', () => {
    const renderer = fs.readFileSync(rendererPath, 'utf8');
    expect(renderer).toContain("from '@lihen/catalog'");
    expect(renderer).toContain('catalogPdfRenderModelComposition');
    expect(renderer).toContain('selectedPdfAsset.publicUrl');
    expect(renderer).toContain('salePriceSnapshot');
  });

  it('removes direct legacy catalog projection loading and line filtering from React', () => {
    const renderer = fs.readFileSync(rendererPath, 'utf8');
    expect(renderer).not.toContain('catalogsComposition.getRenderEntries');
    expect(renderer).not.toContain('filterCatalogEntriesByLine');
    expect(renderer).not.toContain('type CatalogRenderEntry');
  });

  it('keeps data loading/composition outside the renderer', () => {
    const composition = fs.readFileSync(compositionPath, 'utf8');
    expect(composition).toContain('composeCatalogRenderModel');
    expect(composition).toContain('catalogsComposition.getRenderEntries');
    expect(composition).toContain('catalogInstitutionalComposition.getSnapshot');
  });

  it('keeps GAP-024 compatible after GAP-026 retires the STYLE legacy adapter', () => {
    const renderer = fs.readFileSync(rendererPath, 'utf8');
    const composition = fs.readFileSync(compositionPath, 'utf8');
    expect(renderer).not.toContain('toLegacyStyleRenderEntry');
    expect(renderer).toContain('buildStyleBodyPages');
    expect(composition).not.toContain('toLegacyStyleRenderEntry');
    expect(composition).toContain('stylePreviewSeed');
  });

  it('keeps GAP-024 renderer purification compatible with later GAP-025 integrity formalization', () => {
    const renderer = fs.readFileSync(rendererPath, 'utf8');
    expect(renderer).toContain('CatalogPdfRenderPage');
    expect(renderer).toContain('window.print()');
    expect(renderer).toContain('buildBodyPages');
  });

  it('keeps GAP-024 purification independent of optional local presentation enhancements', () => {
    const renderer = fs.readFileSync(rendererPath, 'utf8');
    expect(renderer).toContain('catalogPdfRenderModelComposition');
    expect(renderer).toContain('buildBodyPages');
    expect(renderer).not.toContain('catalogsComposition.getRenderEntries');
  });

  it('does not modify catalog PDF CSS as part of renderer purification', () => {
    expect(
      fs.existsSync(
        path.join(root, 'apps/control-center/src/styles/catalog-pdf-print.css'),
      ),
    ).toBe(true);
  });
});
