import { describe, expect, it } from 'vitest';
import {
  analyzeProcurementIntelligence,
  type ProcurementIntelligenceInput,
} from '../src/capabilities/procurement-intelligence';

function baseInput(
  overrides: Partial<ProcurementIntelligenceInput> = {},
): ProcurementIntelligenceInput {
  return {
    correlationId: 'corr-procurement-1',
    purchase: {
      id: 'purchase-1',
      purchaseNumber: 'PO-001',
      supplierId: 'supplier-1',
      status: 'CONFIRMED',
      purchaseDate: '2026-08-20',
      expectedDate: '2026-09-02',
      receivedAt: null,
    },
    items: [
      {
        id: 'item-1',
        purchaseId: 'purchase-1',
        productId: 'product-1',
        quantityRequested: 10,
        quantityReceived: 0,
        quotedUnitCost: 10000,
        finalUnitCost: null,
      },
    ],
    policy: {
      overdueGraceDays: 0,
      costIncreaseWarningPercent: 5,
      supplierOverdueRateWarningPercent: 30,
    },
    asOf: '2026-09-03T12:00:00.000Z',
    createdAt: '2026-09-03T12:00:00.000Z',
    ...overrides,
  };
}

describe('WAVE 8 / GAP-028 Procurement Intelligence', () => {
  it('analyzes purchase receipt state deterministically', () => {
    const first = analyzeProcurementIntelligence(baseInput());
    const second = analyzeProcurementIntelligence(baseInput());

    expect(first).toEqual(second);
    expect(first.context.type).toBe('PURCHASE');
    expect(first.metrics.requestedUnits).toBe(10);
    expect(first.metrics.receivedUnits).toBe(0);
    expect(first.metrics.remainingUnits).toBe(10);
    expect(first.metrics.receiptProgressPercent).toBe(0);
  });

  it('detects an overdue receipt without receiving or mutating anything', () => {
    const report = analyzeProcurementIntelligence(baseInput());
    expect(report.signals.map((signal) => signal.kind)).toContain('RECEIPT_OVERDUE');

    const recommendation = report.recommendations.find(
      (candidate) => candidate.actionType === 'REVIEW_OVERDUE_PURCHASE',
    );
    expect(recommendation?.risk.level).toBe('R2');
    expect(recommendation?.risk.requiresHumanReview).toBe(true);
    expect(report.governance.canAutoReceivePurchase).toBe(false);
    expect(report.governance.canAutoPostInventory).toBe(false);
  });

  it('reports partial receipt progress from canonical purchase quantities', () => {
    const report = analyzeProcurementIntelligence(baseInput({
      purchase: {
        ...baseInput().purchase,
        status: 'PARTIALLY_RECEIVED',
      },
      items: [
        {
          id: 'item-1',
          purchaseId: 'purchase-1',
          productId: 'product-1',
          quantityRequested: 10,
          quantityReceived: 4,
          quotedUnitCost: 10000,
          finalUnitCost: 10000,
        },
      ],
    }));

    expect(report.metrics.receiptProgressPercent).toBe(40);
    expect(report.metrics.remainingUnits).toBe(6);
    expect(report.signals.map((signal) => signal.kind)).toContain('PARTIAL_RECEIPT');
  });

  it('detects observed received-cost increases using explicit policy', () => {
    const report = analyzeProcurementIntelligence(baseInput({
      purchase: {
        ...baseInput().purchase,
        status: 'RECEIVED',
        receivedAt: '2026-09-02T10:00:00.000Z',
      },
      items: [
        {
          id: 'item-1',
          purchaseId: 'purchase-1',
          productId: 'product-1',
          quantityRequested: 10,
          quantityReceived: 10,
          quotedUnitCost: 10000,
          finalUnitCost: 11000,
        },
      ],
    }));

    expect(report.metrics.observedQuotedReceiptValue).toBe(100000);
    expect(report.metrics.observedFinalReceiptValue).toBe(110000);
    expect(report.metrics.observedCostVarianceAmount).toBe(10000);
    expect(report.metrics.observedCostVariancePercent).toBeCloseTo(10);
    expect(report.signals.map((signal) => signal.kind)).toContain('COST_INCREASE');
    expect(report.governance.canAutoChangeSupplierCost).toBe(false);
  });

  it('does not invent cost variance when comparable receipt costs are absent', () => {
    const report = analyzeProcurementIntelligence(baseInput());

    expect(report.metrics.observedCostVarianceAmount).toBeNull();
    expect(report.metrics.observedCostVariancePercent).toBeNull();
    expect(report.signals.map((signal) => signal.kind)).not.toContain('COST_INCREASE');
    expect(report.signals.map((signal) => signal.kind)).not.toContain('COST_DECREASE');
  });

  it('uses explicit supplier history to detect a delivery-delay pattern', () => {
    const report = analyzeProcurementIntelligence(baseInput({
      supplierPerformance: {
        supplierId: 'supplier-1',
        purchaseCount: 10,
        overduePurchaseCount: 4,
        receivedPurchaseCount: 8,
        averageReceiptDelayDays: 3.5,
      },
    }));

    expect(report.metrics.supplierOverdueRatePercent).toBe(40);
    expect(report.metrics.supplierAverageReceiptDelayDays).toBe(3.5);
    expect(report.signals.map((signal) => signal.kind)).toContain('SUPPLIER_DELAY_PATTERN');
  });

  it('does not infer supplier performance from a single purchase', () => {
    const report = analyzeProcurementIntelligence(baseInput({
      supplierPerformance: undefined,
    }));

    expect(report.metrics.supplierOverdueRatePercent).toBeNull();
    expect(report.signals.map((signal) => signal.kind)).not.toContain(
      'SUPPLIER_DELAY_PATTERN',
    );
  });

  it('flags inconsistent purchase states instead of repairing them', () => {
    const report = analyzeProcurementIntelligence(baseInput({
      purchase: {
        ...baseInput().purchase,
        status: 'RECEIVED',
        receivedAt: '2026-09-02T10:00:00.000Z',
      },
      items: [
        {
          id: 'item-1',
          purchaseId: 'purchase-1',
          productId: 'product-1',
          quantityRequested: 10,
          quantityReceived: 8,
          quotedUnitCost: 10000,
          finalUnitCost: 10000,
        },
      ],
    }));

    const anomaly = report.recommendations.find(
      (candidate) => candidate.actionType === 'REVIEW_PURCHASE_INTEGRITY',
    );
    expect(anomaly?.risk.level).toBe('R4');
    expect(anomaly?.risk.requiresHumanReview).toBe(true);
    expect(report.governance.canAutoConfirmPurchase).toBe(false);
    expect(report.governance.canAutoPostFinance).toBe(false);
  });

  it('rejects cross-purchase and cross-supplier contamination', () => {
    expect(() => analyzeProcurementIntelligence(baseInput({
      items: [
        {
          id: 'item-1',
          purchaseId: 'other-purchase',
          productId: 'product-1',
          quantityRequested: 10,
          quantityReceived: 0,
          quotedUnitCost: 10000,
          finalUnitCost: null,
        },
      ],
    }))).toThrow('Every Purchase Item');

    expect(() => analyzeProcurementIntelligence(baseInput({
      supplierPerformance: {
        supplierId: 'other-supplier',
        purchaseCount: 1,
        overduePurchaseCount: 0,
        receivedPurchaseCount: 1,
      },
    }))).toThrow('purchase supplier');
  });

  it('keeps thresholds explicit and rejects invalid analytical inputs', () => {
    expect(() => analyzeProcurementIntelligence(baseInput({
      policy: {
        overdueGraceDays: -1,
        costIncreaseWarningPercent: 5,
        supplierOverdueRateWarningPercent: 30,
      },
    }))).toThrow('overdueGraceDays');

    expect(() => analyzeProcurementIntelligence(baseInput({
      policy: {
        overdueGraceDays: 0,
        costIncreaseWarningPercent: 101,
        supplierOverdueRateWarningPercent: 30,
      },
    }))).toThrow('costIncreaseWarningPercent');
  });
});
