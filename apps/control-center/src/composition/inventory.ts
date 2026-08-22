import { UuidGenerator } from '@lihen/core';
import { getBrowserSupabaseClient, parseBrowserEnv } from '@lihen/database';
import { GetInventoryHandler, GetInventoryMovementsHandler, InMemoryInventoryRepository, RecordInventoryAdjustmentHandler, SupabaseInventoryRepository, type InventoryRepository } from '@lihen/inventory';

export interface InventoryComposition {
  readonly canAdjustOnHand: boolean;
  readonly repository: InventoryRepository;
  readonly getInventory: GetInventoryHandler;
  readonly getMovements: GetInventoryMovementsHandler;
  readonly recordAdjustment: RecordInventoryAdjustmentHandler;
  readonly ids: UuidGenerator;
}

export function createInventoryComposition(env: Record<string, unknown> = import.meta.env): InventoryComposition {
  const parsed = parseBrowserEnv(env);
  const controlled = parsed.VITE_INVENTORY_WRITE_MODE === 'controlled';
  const repository: InventoryRepository = parsed.VITE_PRODUCT_READ_SOURCE === 'supabase'
    ? new SupabaseInventoryRepository(getBrowserSupabaseClient(env), { controlledWriteEnabled: controlled })
    : new InMemoryInventoryRepository();
  return {
    canAdjustOnHand: parsed.VITE_PRODUCT_READ_SOURCE === 'memory' || controlled,
    repository,
    getInventory: new GetInventoryHandler(repository),
    getMovements: new GetInventoryMovementsHandler(repository),
    recordAdjustment: new RecordInventoryAdjustmentHandler(repository),
    ids: new UuidGenerator(),
  };
}

export const inventoryComposition = createInventoryComposition();
