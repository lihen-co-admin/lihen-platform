import { describe, expect, it, vi } from 'vitest';
import { InMemoryOrderRepository } from '../src/infrastructure/in-memory-order-repository';
import { SupabaseOrderRepository } from '../src/infrastructure/supabase-order-repository';

describe('Order customer assignment', () => {
  it('assigns a customer in memory and preserves the order', async () => {
    const repository = new InMemoryOrderRepository();

    await repository.createDraft({
      operationKey: 'create-order-1',
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      channel: 'WEB',
      customerName: null,
      customerPhone: null,
      notes: null,
      requestedAt: null,
      items: [],
    });

    const result = await repository.assignCustomer({
      operationKey: 'assign-order-1',
      orderId: 'order-1',
      customerId: 'customer-1',
    });

    expect(result.id).toBe('order-1');
    expect(result.customerId).toBe('customer-1');
  });

  it('rejects in-memory assignment for an unknown order', async () => {
    const repository = new InMemoryOrderRepository();

    await expect(
      repository.assignCustomer({
        operationKey: 'assign-missing',
        orderId: 'missing-order',
        customerId: 'customer-1',
      }),
    ).rejects.toThrow('ORDER_NOT_FOUND');
  });

  it('blocks Supabase assignment when controlled writes are disabled', async () => {
    const client = {} as never;
    const repository = new SupabaseOrderRepository(client);

    await expect(
      repository.assignCustomer({
        operationKey: 'assign-order-1',
        orderId: 'order-1',
        customerId: 'customer-1',
      }),
    ).rejects.toThrow('ORDER_WRITE_BLOCKED');
  });

  it('uses assign_order_customer_controlled when controlled writes are enabled', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'order-1',
        order_number: 'ORD-1',
        status: 'DRAFT',
        channel: 'WEB',
        customer_id: 'customer-1',
        customer_name: 'Cliente',
        customer_phone: '3000000000',
        notes: null,
        requested_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const client = {
      rpc,
      from,
    } as never;

    const repository = new SupabaseOrderRepository(client, {
      controlledWriteEnabled: true,
    });

    const result = await repository.assignCustomer({
      operationKey: 'assign-order-1',
      orderId: 'order-1',
      customerId: 'customer-1',
    });

    expect(rpc).toHaveBeenCalledWith(
      'assign_order_customer_controlled',
      {
        p_operation_key: 'assign-order-1',
        p_order_id: 'order-1',
        p_customer_id: 'customer-1',
      },
    );
    expect(result.customerId).toBe('customer-1');
  });
});
