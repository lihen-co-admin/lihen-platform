import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('LIHEN Control Center vertical rhythm', () => {
  const css = readFileSync(
    'apps/control-center/src/styles/app.css',
    'utf8',
  );

  const detail = readFileSync(
    'apps/control-center/src/pages/ProductDetailPage.tsx',
    'utf8',
  );

  it('uses one canonical stack authority for page section spacing', () => {
    expect(
      css.match(/\.stack\s*\{\s*display:\s*grid;\s*gap:\s*var\(--space-6\);\s*\}/g),
    ).toHaveLength(1);
  });

  it('lets the parent stack control Product Detail section spacing', () => {
    expect(detail).toContain('<section className="stack">');
    expect(css).not.toContain(
      '.detail-card {\n  margin-top: 1rem;',
    );
  });

  it('applies the canonical page rhythm to product management workflows', () => {
    const pages = [
      'apps/control-center/src/pages/CreateProductPage.tsx',
      'apps/control-center/src/pages/UpdateProductPage.tsx',
      'apps/control-center/src/pages/ChangeProductSalePricePage.tsx',
      'apps/control-center/src/pages/ProductDetailPage.tsx',
    ];

    for (const page of pages) {
      const source = readFileSync(page, 'utf8');
      expect(source).toContain('<section className="stack">');
    }
  });

  it('reduces the shared rhythm consistently on smaller screens', () => {
    expect(css).toContain(
      '/* Canonical vertical rhythm responsive rule */',
    );
    expect(css).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.stack\s*\{\s*gap:\s*var\(--space-4\);/,
    );
  });
  it('keeps Product Images under the canonical root stack authority', () => {
    const source = readFileSync(
      'apps/control-center/src/pages/ProductImagesPage.tsx',
      'utf8',
    );

    expect(source).toMatch(
      /<section className="stack">\s*<AdminPageHero/,
    );
  });

});
