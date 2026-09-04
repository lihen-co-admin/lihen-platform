import { describe, expect, it } from 'vitest';
import { analyzeOrdersSalesIntelligence } from '../src/capabilities/orders-sales-intelligence';

const base = {
  correlationId: 'corr-gap029',
  policy: {
    activeOrderAttentionHours: 48,
    readyOrderAttentionHours: 24,
  },
  asOf: '2026-09-03T20:00:00.000Z',
  createdAt: '2026-09-03T20:00:00.000Z',
} as const;

describe('Orders & Sales Intelligence', () => {
  it('keeps a healthy completed commerce snapshot read-only and signal-free', () => {
    const report = analyzeOrdersSalesIntelligence({
      ...base,
      orders: [{
        id: 'order-1',
        orderNumber: 'ORD-001',
        status: 'COMPLETED',
        updatedAt: '2026-09-03T18:00:00.000Z',
      }],
      sales: [{
        id: 'sale-1',
        saleNumber: 'SALE-001',
        orderId: 'order-1',
        status: 'COMPLETED',
        occurredAt: '2026-09-03T18:00:00.000Z',
        totalAmount: 125000,
      }],
      commerceReconciliations: [{
        saleId: 'sale-1',
        status: 'PASS',
        blockers: [],
        warnings: [],
      }],
      cancellationReconciliations: [],
    });

    expect(report.signals).toEqual([]);
    expect(report.metrics.completedOrders).toBe(1);
    expect(report.metrics.completedSales).toBe(1);
    expect(report.metrics.observedCompletedSalesAmount).toBe(125000);
    expect(report.governance.canAutoCompleteSale).toBe(false);
    expect(report.governance.canAutoPostFinance).toBe(false);
  });

  it('detects a completed order without its required linked sale', () => {
    const report = analyzeOrdersSalesIntelligence({
      ...base,
      orders: [{
        id: 'order-2',
        orderNumber: 'ORD-002',
        status: 'COMPLETED',
        updatedAt: '2026-09-03T18:00:00.000Z',
      }],
      sales: [],
    });

    const signal = report.signals.find(
      (candidate) => candidate.kind === 'ORDER_INTEGRITY_ANOMALY',
    );
    expect(signal?.severity).toBe('CRITICAL');
    expect(report.recommendations[0]?.risk.level).toBe('R4');
    expect(report.recommendations[0]?.risk.requiresHumanReview).toBe(true);
  });

  it('detects a cancelled order that still has a linked sale', () => {
    const report = analyzeOrdersSalesIntelligence({
      ...base,
      orders: [{
        id: 'order-3',
        orderNumber: 'ORD-003',
        status: 'CANCELLED',
        updatedAt: '2026-09-03T18:00:00.000Z',
      }],
      sales: [{
        id: 'sale-3',
        saleNumber: 'SALE-003',
        orderId: 'order-3',
        status: 'COMPLETED',
        occurredAt: '2026-09-03T18:30:00.000Z',
        totalAmount: 50000,
      }],
    });

    expect(
      report.signals.some((signal) => signal.kind === 'ORDER_INTEGRITY_ANOMALY'),
    ).toBe(true);
  });

  it('flags stale active orders only after explicit policy thresholds', () => {
    const report = analyzeOrdersSalesIntelligence({
      ...base,
      orders: [{
        id: 'order-4',
        orderNumber: 'ORD-004',
        status: 'PREPARING',
        updatedAt: '2026-08-31T12:00:00.000Z',
      }],
      sales: [],
    });

    expect(report.metrics.staleActiveOrders).toBe(1);
    expect(
      report.signals.some((signal) => signal.kind === 'ORDER_ATTENTION_REQUIRED'),
    ).toBe(true);
  });

  it('surfaces READY orders without auto-completing the sale', () => {
    const report = analyzeOrdersSalesIntelligence({
      ...base,
      orders: [{
        id: 'order-5',
        orderNumber: 'ORD-005',
        status: 'READY',
        updatedAt: '2026-09-03T19:30:00.000Z',
      }],
      sales: [],
    });

    const ready = report.signals.find(
      (signal) => signal.kind === 'ORDER_READY_FOR_SALE',
    );
    expect(ready?.severity).toBe('SUCCESS');
    expect(report.governance.canAutoCompleteSale).toBe(false);
    expect(report.metrics.saleEligibleOrders).toBe(1);
  });

  it('promotes blocked commerce reconciliation to R4 human review', () => {
    const report = analyzeOrdersSalesIntelligence({
      ...base,
      orders: [],
      sales: [{
        id: 'sale-6',
        saleNumber: 'SALE-006',
        orderId: null,
        status: 'COMPLETED',
        occurredAt: '2026-09-03T19:00:00.000Z',
        totalAmount: 75000,
      }],
      commerceReconciliations: [{
        saleId: 'sale-6',
        status: 'BLOCKED',
        blockers: ['SALE_INCOME_MISSING'],
        warnings: [],
      }],
    });

    const index = report.signals.findIndex(
      (signal) => signal.kind === 'COMMERCE_RECONCILIATION_BLOCKED',
    );
    expect(index).toBeGreaterThanOrEqual(0);
    expect(report.recommendations[index]?.risk.level).toBe('R4');
  });

  it('surfaces blocked cancellation reconciliation without repairing reservations', () => {
    const report = analyzeOrdersSalesIntelligence({
      ...base,
      orders: [{
        id: 'order-7',
        orderNumber: 'ORD-007',
        status: 'CANCELLED',
        updatedAt: '2026-09-03T18:00:00.000Z',
      }],
      sales: [],
      cancellationReconciliations: [{
        orderId: 'order-7',
        status: 'BLOCKED',
        blockers: ['CANCELLED_RESERVATION_RELEASE_MISMATCH:product-1'],
        warnings: [],
      }],
    });

    expect(
      report.signals.some(
        (signal) => signal.kind === 'CANCELLATION_RECONCILIATION_BLOCKED',
      ),
    ).toBe(true);
    expect(report.governance.canAutoMoveInventory).toBe(false);
  });

  it('keeps reversed sales as audit evidence and never auto-reverses', () => {
    const report = analyzeOrdersSalesIntelligence({
      ...base,
      orders: [],
      sales: [{
        id: 'sale-8',
        saleNumber: 'SALE-008',
        orderId: null,
        status: 'REVERSED',
        occurredAt: '2026-09-02T19:00:00.000Z',
        totalAmount: 90000,
      }],
    });

    const signal = report.signals.find(
      (candidate) => candidate.kind === 'REVERSED_SALE_AUDIT',
    );
    expect(signal?.severity).toBe('WARNING');
    expect(report.governance.canAutoReverseSale).toBe(false);
  });

  it('fails closed on duplicate transactional identifiers', () => {
    expect(() => analyzeOrdersSalesIntelligence({
      ...base,
      orders: [
        {
          id: 'duplicate',
          orderNumber: 'ORD-A',
          status: 'DRAFT',
          updatedAt: '2026-09-03T19:00:00.000Z',
        },
        {
          id: 'duplicate',
          orderNumber: 'ORD-B',
          status: 'DRAFT',
          updatedAt: '2026-09-03T19:00:00.000Z',
        },
      ],
      sales: [],
    })).toThrow('Order IDs must be unique.');
  });

  it('rejects negative sale totals and invalid dates', () => {
    expect(() => analyzeOrdersSalesIntelligence({
      ...base,
      orders: [],
      sales: [{
        id: 'sale-negative',
        saleNumber: 'SALE-N',
        orderId: null,
        status: 'COMPLETED',
        occurredAt: '2026-09-03T19:00:00.000Z',
        totalAmount: -1,
      }],
    })).toThrow('sale.totalAmount must be a finite non-negative number.');

    expect(() => analyzeOrdersSalesIntelligence({
      ...base,
      asOf: 'invalid',
      orders: [],
      sales: [],
    })).toThrow('asOf must be a valid date.');
  });
});
