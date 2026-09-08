import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('LIHEN Control Center unified list headers', () => {
  const pages = [
    'apps/control-center/src/pages/BrandsPage.tsx',
    'apps/control-center/src/pages/CategoriesPage.tsx',
    'apps/control-center/src/pages/OrdersPage.tsx',
    'apps/control-center/src/pages/PurchasesPage.tsx',
    'apps/control-center/src/pages/CloudWorkspacePage.tsx',
    'apps/control-center/src/pages/CatalogsPage.tsx',
  ];

  it('uses the unified table toolbar for primary list headers', () => {
    for (const page of pages) {
      const source = readFileSync(page, 'utf8');

      expect(source).toContain(
        'className="table-toolbar table-toolbar--unified"',
      );

      expect(source).toContain(
        'className="table-summary-copy"',
      );
    }
  });

  it('does not reintroduce the legacy table-summary header in migrated pages', () => {
    for (const page of pages) {
      const source = readFileSync(page, 'utf8');

      expect(source).not.toContain(
        'className="table-summary"',
      );
    }
  });
  it('keeps mixed-page operational controls separate from unified list headers', () => {
    const catalogs = readFileSync(
      'apps/control-center/src/pages/CatalogsPage.tsx',
      'utf8',
    );
    const cloud = readFileSync(
      'apps/control-center/src/pages/CloudWorkspacePage.tsx',
      'utf8',
    );

    expect(catalogs).toContain('Productos candidatos');
    expect(catalogs).toContain('Preparar cutover web');
    expect(catalogs).toContain('Abrir renderer PDF');
    expect(
      catalogs.match(/table-toolbar table-toolbar--unified/g),
    ).toHaveLength(1);

    expect(
      cloud.match(/table-toolbar table-toolbar--unified/g),
    ).toHaveLength(1);
  });

});
