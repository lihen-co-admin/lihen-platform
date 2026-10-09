import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(
  resolve(process.cwd(), 'apps/control-center/src/pages/SalesPage.tsx'),
  'utf8',
);

describe('Ventas POS DEV: previsualización segura', () => {
  it('muestra la consulta solo cuando las escrituras están bloqueadas', () => {
    expect(page).toContain('{!salesComposition.canWrite ? (');
    expect(page).toContain('data-testid="sales-pos-readonly-preview"');
  });

  it('conserva el bloqueo de los formularios comerciales', () => {
    expect(page).toContain(
      '{salesComposition.canWrite && accounts.length > 0 ? (',
    );
    expect(page).toContain('onSubmit={submitPos}');
    expect(page).toContain('onSubmit={submitOrder}');
  });

  it('reutiliza clientes activos sin emitir ventas desde la vista', () => {
    const start = page.indexOf('data-testid="sales-pos-readonly-preview"');
    const end = page.indexOf(
      '{salesComposition.canWrite && accounts.length > 0 ? (',
      start,
    );
    const preview = page.slice(start, end);

    expect(preview).toContain('customers.map(');
    expect(preview).toContain('setSelectedCustomerId(');
    expect(preview).not.toContain('submitPos(');
    expect(preview).not.toContain('createPos(');
    expect(preview).not.toContain('onSubmit=');
  });
});
