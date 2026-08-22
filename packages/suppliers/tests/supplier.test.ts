import { describe, expect, it } from 'vitest';
import { createSupplier, normalizeSupplierName } from '../src';

describe('supplier domain', () => {
  it('normalizes a canonical supplier name without inventing identity data', () => {
    expect(normalizeSupplierName('  Glow   Belleza & Accesorios  ')).toBe(
      'glow belleza & accesorios',
    );
  });

  it('creates a supplier with conservative ACTIVE default', () => {
    const now = new Date('2026-08-22T03:55:00.000Z');
    const supplier = createSupplier({
      id: 'supplier-1',
      businessName: 'Proveedor Ejemplo',
      now,
    });

    expect(supplier.status).toBe('ACTIVE');
    expect(supplier.averageDeliveryDays).toBeNull();
    expect(supplier.createdAt).toEqual(now);
  });

  it('rejects invalid delivery-day values', () => {
    expect(() =>
      createSupplier({
        id: 'supplier-1',
        businessName: 'Proveedor Ejemplo',
        averageDeliveryDays: -1,
      }),
    ).toThrow('SUPPLIER_AVERAGE_DELIVERY_DAYS_INVALID');
  });
});
