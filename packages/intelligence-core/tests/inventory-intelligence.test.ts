import { describe, expect, it } from 'vitest';
import {
  analyzeInventoryIntelligence,
  type InventoryIntelligenceInput,
} from '../src/capabilities/inventory-intelligence';

function baseInput(
  overrides: Partial<InventoryIntelligenceInput> = {},
): InventoryIntelligenceInput {
  return {
    correlationId: 'corr-inventory-1',
    productId: 'product-1',
    balance: {
      productId: 'product-1',
      stockOnHand: 20,
      stockReserved: 2,
      stockPending: 4,
      stockAvailable: 18,
    },
    movements: [
      {
        id: 'movement-1',
        productId: 'product-1',
        bucket: 'ON_HAND',
        quantityDelta: 10,
        occurredAt: '2026-08-30T12:00:00.000Z',
      },
    ],
    demand: {
      unitsSold: 14,
      windowDays: 14,
    },
    policy: {
      criticalAvailableThreshold: 3,
      overstockDaysOfCoverThreshold: 45,
      immobileDaysThreshold: 30,
      replenishmentTargetDaysOfCover: 21,
    },
    asOf: '2026-09-03T12:00:00.000Z',
    createdAt: '2026-09-03T12:00:00.000Z',
    ...overrides,
  };
}

describe('WAVE 8 / GAP-027 Inventory Intelligence', () => {
  it('analyzes governed balance, demand and movement history deterministically', () => {
    const first = analyzeInventoryIntelligence(baseInput());
    const second = analyzeInventoryIntelligence(baseInput());

    expect(first).toEqual(second);
    expect(first.context.type).toBe('INVENTORY');
    expect(first.metrics.averageDailyDemand).toBe(1);
    expect(first.metrics.daysOfCover).toBe(18);
    expect(first.metrics.projectedStockoutDays).toBe(18);
  });

  it('detects critical stock and suggests replenishment without executing a movement', () => {
    const report = analyzeInventoryIntelligence(
      baseInput({
        balance: {
          productId: 'product-1',
          stockOnHand: 3,
          stockReserved: 1,
          stockPending: 2,
          stockAvailable: 2,
        },
      }),
    );

    expect(report.signals.map((signal) => signal.kind)).toContain(
      'CRITICAL_STOCK',
    );
    expect(report.signals.map((signal) => signal.kind)).toContain(
      'REPLENISHMENT_SUGGESTED',
    );
    expect(report.metrics.suggestedReplenishmentQuantity).toBe(17);

    const replenishment = report.recommendations.find(
      (recommendation) =>
        recommendation.actionType === 'REVIEW_REPLENISHMENT_SUGGESTION',
    );

    expect(replenishment?.risk).toEqual({
      level: 'R3',
      reasons: [
        'A replenishment decision may create economic or procurement commitments.',
        'The recommendation is advisory and requires governed human execution.',
      ],
      requiresHumanReview: true,
    });
    expect(replenishment?.status).toBe('OPEN');
  });

  it('detects potential overstock from explicit policy and observed demand', () => {
    const report = analyzeInventoryIntelligence(
      baseInput({
        balance: {
          productId: 'product-1',
          stockOnHand: 80,
          stockReserved: 0,
          stockPending: 0,
          stockAvailable: 80,
        },
      }),
    );

    expect(report.metrics.daysOfCover).toBe(80);
    expect(report.signals.map((signal) => signal.kind)).toContain('OVERSTOCK');
  });

  it('detects immobile stock only when movement history supports it', () => {
    const report = analyzeInventoryIntelligence(
      baseInput({
        movements: [
          {
            id: 'movement-old',
            productId: 'product-1',
            bucket: 'ON_HAND',
            quantityDelta: 1,
            occurredAt: '2026-06-01T12:00:00.000Z',
          },
        ],
      }),
    );

    expect(report.signals.map((signal) => signal.kind)).toContain(
      'IMMOBILE_STOCK',
    );

    const withoutHistory = analyzeInventoryIntelligence(
      baseInput({ movements: [] }),
    );
    expect(withoutHistory.signals.map((signal) => signal.kind)).not.toContain(
      'IMMOBILE_STOCK',
    );
  });

  it('does not invent rotation, projection or replenishment when demand is absent', () => {
    const report = analyzeInventoryIntelligence(
      baseInput({ demand: undefined }),
    );

    expect(report.metrics.averageDailyDemand).toBeNull();
    expect(report.metrics.daysOfCover).toBeNull();
    expect(report.metrics.projectedStockoutDays).toBeNull();
    expect(report.metrics.suggestedReplenishmentQuantity).toBeNull();
    expect(report.signals.map((signal) => signal.kind)).not.toContain(
      'ROTATION_OBSERVED',
    );
    expect(report.signals.map((signal) => signal.kind)).not.toContain(
      'STOCKOUT_PROJECTION',
    );
    expect(report.signals.map((signal) => signal.kind)).not.toContain(
      'REPLENISHMENT_SUGGESTED',
    );
  });

  it('flags inconsistent governed balances instead of silently correcting them', () => {
    const report = analyzeInventoryIntelligence(
      baseInput({
        balance: {
          productId: 'product-1',
          stockOnHand: 10,
          stockReserved: 2,
          stockPending: 0,
          stockAvailable: 9,
        },
      }),
    );

    const anomaly = report.recommendations.find(
      (recommendation) =>
        recommendation.actionType === 'REVIEW_INVENTORY_INTEGRITY',
    );

    expect(anomaly?.risk.level).toBe('R4');
    expect(anomaly?.risk.requiresHumanReview).toBe(true);
    expect(report.signals[0]?.kind).toBe('INTEGRITY_ANOMALY');
  });

  it('keeps policy thresholds explicit and rejects invalid analytical inputs', () => {
    expect(() =>
      analyzeInventoryIntelligence(
        baseInput({
          policy: {
            criticalAvailableThreshold: -1,
            overstockDaysOfCoverThreshold: 45,
            immobileDaysThreshold: 30,
            replenishmentTargetDaysOfCover: 21,
          },
        }),
      ),
    ).toThrow('criticalAvailableThreshold');

    expect(() =>
      analyzeInventoryIntelligence(
        baseInput({
          demand: {
            unitsSold: 10,
            windowDays: 0,
          },
        }),
      ),
    ).toThrow('demand.windowDays');
  });

  it('rejects cross-product balance or movement contamination', () => {
    expect(() =>
      analyzeInventoryIntelligence(
        baseInput({
          balance: {
            productId: 'other-product',
            stockOnHand: 10,
            stockReserved: 0,
            stockPending: 0,
            stockAvailable: 10,
          },
        }),
      ),
    ).toThrow('balance productId');

    expect(() =>
      analyzeInventoryIntelligence(
        baseInput({
          movements: [
            {
              id: 'wrong-product',
              productId: 'other-product',
              bucket: 'ON_HAND',
              quantityDelta: 1,
              occurredAt: '2026-09-01T12:00:00.000Z',
            },
          ],
        }),
      ),
    ).toThrow('Every Inventory movement');
  });
});
