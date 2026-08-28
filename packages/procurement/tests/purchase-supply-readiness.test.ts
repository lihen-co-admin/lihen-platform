import { describe, expect, it } from 'vitest';
import { evaluatePurchaseSupplyReadiness, type Purchase, type PurchaseItem } from '../src';

const basePurchase: Purchase = {
  id: 'purchase-1',
  purchaseNumber: 'OC-001',
  supplierId: 'supplier-1',
  status: 'DRAFT',
  purchaseDate: '2026-08-20',
  expectedDate: '2026-08-25',
  receivedAt: null,
  notes: null,
  historical: false,
  createdAt: new Date('2026-08-20T12:00:00Z'),
  updatedAt: new Date('2026-08-20T12:00:00Z'),
};

const item = (received: number): PurchaseItem => ({
  id: 'item-1', purchaseId: 'purchase-1', productId: 'product-1', quantityRequested: 10,
  quantityReceived: received, quotedUnitCost: 1000, finalUnitCost: received > 0 ? 1100 : null,
  createdAt: new Date('2026-08-20T12:00:00Z'), updatedAt: new Date('2026-08-20T12:00:00Z'),
});

describe('evaluatePurchaseSupplyReadiness', () => {
  it('permite confirmar un borrador válido sin considerar que ya afectó inventario', () => {
    const readiness = evaluatePurchaseSupplyReadiness(basePurchase, [item(0)], new Date('2026-08-21T12:00:00Z'));
    expect(readiness.status).toBe('DRAFT');
    expect(readiness.canConfirm).toBe(true);
    expect(readiness.canReceive).toBe(false);
    expect(readiness.remainingUnits).toBe(10);
  });

  it('marca una compra confirmada vencida y pendiente de recepción', () => {
    const readiness = evaluatePurchaseSupplyReadiness(
      { ...basePurchase, status: 'CONFIRMED' }, [item(0)], new Date('2026-08-27T12:00:00Z'),
    );
    expect(readiness.status).toBe('AWAITING_RECEIPT');
    expect(readiness.overdue).toBe(true);
    expect(readiness.canReceive).toBe(true);
  });

  it('calcula recepción parcial y progreso', () => {
    const readiness = evaluatePurchaseSupplyReadiness({ ...basePurchase, status: 'PARTIALLY_RECEIVED' }, [item(4)]);
    expect(readiness.status).toBe('PARTIAL_RECEIPT');
    expect(readiness.receiptProgressPercent).toBe(40);
    expect(readiness.remainingUnits).toBe(6);
  });

  it('considera completa una compra recibida', () => {
    const readiness = evaluatePurchaseSupplyReadiness({ ...basePurchase, status: 'RECEIVED' }, [item(10)]);
    expect(readiness.status).toBe('RECEIVED');
    expect(readiness.receiptProgressPercent).toBe(100);
    expect(readiness.canReceive).toBe(false);
  });

  it('bloquea una compra sin líneas', () => {
    const readiness = evaluatePurchaseSupplyReadiness(basePurchase, []);
    expect(readiness.canConfirm).toBe(false);
    expect(readiness.blockers).toContain('La compra no tiene líneas de producto.');
  });
});
