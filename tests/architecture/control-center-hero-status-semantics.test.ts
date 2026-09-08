import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('LIHEN Control Center hero status semantics', () => {
  const sales = readFileSync(
    'apps/control-center/src/pages/SalesPage.tsx',
    'utf8',
  );

  const finance = readFileSync(
    'apps/control-center/src/pages/FinancePage.tsx',
    'utf8',
  );

  it('keeps Sales and Finance hero status compact', () => {
    expect(sales).not.toContain('status={<><strong>');
    expect(finance).not.toContain('status={<><strong>');

    expect(sales).toContain(
      "status={salesComposition.canWrite ? 'Operación controlada disponible' : 'Escritura bloqueada'}",
    );

    expect(finance).toContain(
      "status={financeComposition.canWrite ? 'Operación controlada disponible' : 'Escritura bloqueada'}",
    );
  });

  it('moves explanatory copy into the hero description', () => {
    expect(sales).toContain(
      'La UI no modifica saldos ni stock directamente.',
    );

    expect(finance).toContain(
      'Las reversiones se realizan mediante contramovimiento.',
    );
  });
});
