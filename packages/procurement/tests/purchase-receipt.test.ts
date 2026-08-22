import { describe, expect, it } from 'vitest';
import { InMemoryPurchaseRepository } from '../src/infrastructure/in-memory-purchase-repository';

describe('purchase confirmation and receipt', () => {
  it('moves DRAFT -> CONFIRMED -> RECEIVED without hidden finance effects', async () => {
    const repository = new InMemoryPurchaseRepository();
    await repository.createDraft({operationKey:'d',purchaseId:'p1',purchaseNumber:'OC-1',supplierId:'s1',purchaseDate:null,expectedDate:null,notes:null,items:[{id:'i1',productId:'x1',quantityRequested:2,quotedUnitCost:1000}]});
    expect((await repository.confirm({operationKey:'c',purchaseId:'p1',occurredAt:new Date()})).status).toBe('CONFIRMED');
    expect((await repository.receive({operationKey:'r',purchaseId:'p1',receivedAt:new Date(),notes:null,lines:[{purchaseItemId:'i1',quantityReceived:2,finalUnitCost:950}]})).status).toBe('RECEIVED');
    expect((await repository.listItems('p1'))[0]?.quantityReceived).toBe(2);
  });
});
