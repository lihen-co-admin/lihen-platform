import { describe, expect, it } from 'vitest';
import { InMemoryInventoryRepository, RecordInventoryAdjustmentHandler } from '../src';

describe('inventory adjustment', () => {
  it('records a controlled ON_HAND adjustment and derives available stock', async () => {
    const repo = new InMemoryInventoryRepository(); const handler = new RecordInventoryAdjustmentHandler(repo);
    const result = await handler.execute({ operationKey: 'op-1', movementId: 'm-1', productId: 'p-1', quantityDelta: 3, reason: 'PHYSICAL_COUNT_INCREASE', occurredAt: new Date(), notes: null });
    expect(result.stockOnHand).toBe(3); expect(result.stockAvailable).toBe(3); expect((await repo.listMovements('p-1'))).toHaveLength(1);
  });
  it('rejects a negative physical balance', async () => {
    const repo = new InMemoryInventoryRepository(); const handler = new RecordInventoryAdjustmentHandler(repo);
    await expect(handler.execute({ operationKey: 'op-2', movementId: 'm-2', productId: 'p-1', quantityDelta: -1, reason: 'PHYSICAL_COUNT_DECREASE', occurredAt: new Date(), notes: null })).rejects.toThrow();
  });
});
