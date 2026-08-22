import { describe, expect, it } from 'vitest';
import { CreateSupplierHandler, InMemorySupplierRepository, UpdateSupplierHandler } from '../src';

describe('supplier application', () => {
  it('creates and updates a canonical supplier without inventing product links', async () => {
    const repo = new InMemorySupplierRepository();
    const create = new CreateSupplierHandler(repo);
    const update = new UpdateSupplierHandler(repo);
    await create.execute({ operationKey:'a', supplierId:'s1', businessName:'  Proveedor Uno  ', contactName:null, whatsapp:null, email:null, city:'Cali', averageDeliveryDays:2, notes:null, status:'ACTIVE' });
    const changed = await update.execute({ operationKey:'b', supplierId:'s1', businessName:'Proveedor Uno', contactName:'Ana', whatsapp:null, email:null, city:'Cali', averageDeliveryDays:3, notes:'Confirmado', status:'ACTIVE' });
    expect(changed.contactName).toBe('Ana');
    expect(changed.averageDeliveryDays).toBe(3);
    expect((await repo.list())).toHaveLength(1);
  });
});
