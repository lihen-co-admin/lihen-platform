import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'apps/control-center/src/pages/SuppliersPage.tsx'),
  'utf8',
);

describe('Supplier browser controlled-write idempotency wiring', () => {
  it('preserves one operation key across a failed browser retry', () => {
    expect(source).toContain('useRef');
    expect(source).toContain('operationKeyRef');
    expect(source).toContain(
      "operationKeyRef.current??`supplier:${operationKind}:${crypto.randomUUID()}`",
    );
    expect(source).toContain('operationKeyRef.current=operationKey');
  });

  it('clears the operation key after a successful controlled save', () => {
    expect(source).toContain(
      "operationKeyRef.current=null; setForm(emptyForm); setMessage('Proveedor guardado mediante operación controlada.')",
    );
  });

  it('does not contain a direct supplier delete path', () => {
    expect(source).not.toMatch(/deleteSupplier|delete_supplier|\.delete\(/);
  });
});

describe('Supplier edit visual navigation', () => {
  it('reveals and focuses the Supplier Master form after Edit', () => {
    expect(source).toContain('formRef');
    expect(source).toContain('businessNameRef');
    expect(source).toContain('scrollIntoView');
    expect(source).toContain("behavior: 'smooth'");
    expect(source).toContain("block: 'start'");
    expect(source).toContain('businessNameRef.current?.focus({ preventScroll: true })');
    expect(source).toContain('revealSupplierForm();');
  });
});
