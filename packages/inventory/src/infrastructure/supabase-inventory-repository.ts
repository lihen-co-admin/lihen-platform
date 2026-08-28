import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecordInventoryAdjustmentCommand } from '../application/commands/record-inventory-adjustment.command';
import type { InventoryBalance } from '../domain/inventory-balance';
import type { InventoryMovement } from '../domain/inventory-movement';
import {
  InventoryAdjustmentForbiddenError,
  InventoryBalanceViolationError,
  InventoryWriteBlockedError,
  InventoryWriteOperationConflictError,
} from '../domain/errors/inventory-errors';
import type { InventoryRepository } from '../ports/inventory-repository';

interface Options { readonly controlledWriteEnabled?: boolean; }

function mapBalance(row: Record<string, unknown>): InventoryBalance {
  return {
    productId: String(row.product_id),
    stockOnHand: Number(row.stock_on_hand ?? 0),
    stockReserved: Number(row.stock_reserved ?? 0),
    stockPending: Number(row.stock_pending ?? 0),
    stockAvailable: Number(row.stock_available ?? 0),
  };
}

export class SupabaseInventoryRepository implements InventoryRepository {
  private readonly controlledWriteEnabled: boolean;
  public constructor(private readonly client: SupabaseClient, options: Options = {}) {
    this.controlledWriteEnabled = options.controlledWriteEnabled ?? false;
  }

  public async listBalances(): Promise<readonly InventoryBalance[]> {
    const { data, error } = await this.client.from('inventory_stock').select('*').order('product_id');
    if (error) throw new Error(`Unable to read inventory balances: ${error.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(mapBalance);
  }

  public async getBalance(productId: string): Promise<InventoryBalance> {
    const { data, error } = await this.client.from('inventory_stock').select('*').eq('product_id', productId).single();
    if (error) throw new Error(`Unable to read inventory balance: ${error.message}`);
    return mapBalance(data as Record<string, unknown>);
  }

  public async listMovements(productId: string): Promise<readonly InventoryMovement[]> {
    const { data, error } = await this.client.from('inventory_movements')
      .select('id,product_id,bucket,quantity_delta,reason,occurred_at,recorded_at,external_reference,notes')
      .eq('product_id', productId).order('occurred_at', { ascending: false });
    if (error) throw new Error(`Unable to read inventory movements: ${error.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id), productId: String(row.product_id), bucket: String(row.bucket) as InventoryMovement['bucket'],
      quantityDelta: Number(row.quantity_delta), reason: String(row.reason), occurredAt: new Date(String(row.occurred_at)),
      recordedAt: new Date(String(row.recorded_at)), externalReference: row.external_reference ? String(row.external_reference) : null,
      notes: row.notes ? String(row.notes) : null,
    }));
  }

  public async listMovementsByExternalReferences(externalReferences: readonly string[]): Promise<readonly InventoryMovement[]> {
    if (externalReferences.length === 0) return [];
    const { data, error } = await this.client.from('inventory_movements')
      .select('id,product_id,bucket,quantity_delta,reason,occurred_at,recorded_at,external_reference,notes')
      .in('external_reference', [...externalReferences]).order('occurred_at', { ascending: false });
    if (error) throw new Error(`Unable to read inventory movements by reference: ${error.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id), productId: String(row.product_id), bucket: String(row.bucket) as InventoryMovement['bucket'],
      quantityDelta: Number(row.quantity_delta), reason: String(row.reason), occurredAt: new Date(String(row.occurred_at)),
      recordedAt: new Date(String(row.recorded_at)), externalReference: row.external_reference ? String(row.external_reference) : null,
      notes: row.notes ? String(row.notes) : null,
    }));
  }

  public async recordOnHandAdjustment(command: RecordInventoryAdjustmentCommand): Promise<InventoryBalance> {
    if (!this.controlledWriteEnabled) throw new InventoryWriteBlockedError();
    const { data, error } = await this.client.rpc('record_inventory_adjustment_controlled', {
      p_operation_key: command.operationKey,
      p_movement_id: command.movementId,
      p_product_id: command.productId,
      p_quantity_delta: command.quantityDelta,
      p_reason: command.reason,
      p_occurred_at: command.occurredAt.toISOString(),
      p_notes: command.notes,
    });
    if (error) {
      const message = `${error.message ?? ''} ${error.details ?? ''}`;
      if (message.includes('permission denied for function')) throw new InventoryWriteBlockedError();
      if (message.includes('LIHEN_INVENTORY_ADJUST_FORBIDDEN')) throw new InventoryAdjustmentForbiddenError();
      if (message.includes('LIHEN_INVENTORY_WRITE_OPERATION_CONFLICT')) throw new InventoryWriteOperationConflictError();
      if (message.includes('LIHEN_INVENTORY_ON_HAND_NEGATIVE') || message.includes('LIHEN_INVENTORY_AVAILABLE_NEGATIVE')) {
        throw new InventoryBalanceViolationError();
      }
      throw new Error(`Unable to record inventory adjustment: ${error.message}`);
    }
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (!row) throw new Error('Controlled inventory RPC returned no result.');
    return mapBalance(row);
  }
}
