import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseSaleRepository } from '../src/infrastructure/supabase-sale-repository';
import type { CreatePosSaleInput } from '../src/domain/sale';

const customerId = '11111111-1111-4111-8111-111111111111';

function input(identified: boolean): CreatePosSaleInput {
  return {
    operationKey: 'pos-sale:test-operation',
    saleId: '22222222-2222-4222-8222-222222222222',
    saleNumber: 'POS-TEST-001',
    financialAccountId: '33333333-3333-4333-8333-333333333333',
    channel: 'IN_PERSON',
    customerName: identified ? null : 'Cliente manual',
    customerPhone: null,
    customerId: identified ? customerId : null,
    occurredAt: new Date('2026-10-08T12:00:00.000Z'),
    notes: null,
    items: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        productId: '55555555-5555-4555-8555-555555555555',
        quantity: 2,
        unitPrice: 12000,
      },
    ],
  };
}

function setup(returnedCustomerId: string | null) {
  const saleRow = {
    id: '22222222-2222-4222-8222-222222222222',
    sale_number: 'POS-TEST-001',
    order_id: null,
    channel: 'IN_PERSON',
    status: 'COMPLETED',
    customer_name: 'Snapshot de cliente',
    customer_id: returnedCustomerId,
    occurred_at: '2026-10-08T12:00:00.000Z',
    total_amount: 24000,
    financial_account_id: '33333333-3333-4333-8333-333333333333',
    notes: null,
  };

  const maybeSingle = vi.fn().mockResolvedValue({
    data: saleRow,
    error: null,
  });

  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi.fn().mockResolvedValue({
    data: [{ sale_id: saleRow.id }],
    error: null,
  });

  const client = { rpc, from } as unknown as SupabaseClient;

  return {
    repo: new SupabaseSaleRepository(client, {
      controlledWriteEnabled: true,
    }),
    rpc,
    from,
  };
}

describe('SALES-POS-CUSTOMER-LINKAGE repository contracts', () => {
  it('preserves the original 10-argument RPC for manual POS', async () => {
    const { repo, rpc } = setup(null);
    const result = await repo.createPos(input(false));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      'create_pos_sale_controlled',
      expect.not.objectContaining({
        p_customer_id: expect.anything(),
      }),
    );

    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(args)).toHaveLength(10);
    expect(args).not.toHaveProperty('p_customer_id');
    expect(args.p_customer_name).toBe('Cliente manual');
    expect(result.customerId).toBeNull();
  });

  it('selects the 11-argument RPC using canonical customer UUID', async () => {
    const { repo, rpc } = setup(customerId);
    const result = await repo.createPos(input(true));

    expect(rpc).toHaveBeenCalledTimes(1);
    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;

    expect(Object.keys(args)).toHaveLength(11);
    expect(args.p_customer_id).toBe(customerId);
    expect(args.p_customer_name).toBeNull();
    expect(result.customerId).toBe(customerId);
    expect(result.customerName).toBe('Snapshot de cliente');
  });

  it('rejects POS writes when controlled writes are disabled', async () => {
    const { rpc, from } = setup(null);
    const client = { rpc, from } as unknown as SupabaseClient;
    const repo = new SupabaseSaleRepository(client, {
      controlledWriteEnabled: false,
    });

    await expect(repo.createPos(input(true))).rejects.toThrow(
      'SALE_WRITE_BLOCKED',
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps order-completion RPC without POS customer argument', async () => {
    const { repo, rpc } = setup(customerId);

    await repo.completeOrder({
      operationKey: 'order-sale:test-operation',
      saleId: '22222222-2222-4222-8222-222222222222',
      saleNumber: 'POS-TEST-001',
      orderId: '66666666-6666-4666-8666-666666666666',
      financialAccountId: '33333333-3333-4333-8333-333333333333',
      occurredAt: new Date('2026-10-08T12:00:00.000Z'),
      notes: null,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      'complete_order_sale_controlled',
      expect.not.objectContaining({
        p_customer_id: expect.anything(),
      }),
    );

    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(args)).toHaveLength(7);
  });
});
