import { UuidGenerator } from '@lihen/core';
import { getBrowserSupabaseClient, parseBrowserEnv } from '@lihen/database';
import { CreateSupplierHandler, GetSuppliersHandler, InMemorySupplierRepository, SupabaseSupplierRepository, UpdateSupplierHandler, type SupplierRepository } from '@lihen/suppliers';

export interface SuppliersComposition {
  readonly repository: SupplierRepository;
  readonly getSuppliers: GetSuppliersHandler;
  readonly createSupplier: CreateSupplierHandler;
  readonly updateSupplier: UpdateSupplierHandler;
  readonly canWrite: boolean;
  readonly ids: UuidGenerator;
}

export function createSuppliersComposition(env: Record<string, unknown> = import.meta.env): SuppliersComposition {
  const parsed = parseBrowserEnv(env);
  const controlled = parsed.VITE_SUPPLIER_WRITE_MODE === 'controlled';
  const repository: SupplierRepository = parsed.VITE_PRODUCT_READ_SOURCE === 'supabase'
    ? new SupabaseSupplierRepository(getBrowserSupabaseClient(env), { controlledWriteEnabled: controlled })
    : new InMemorySupplierRepository();
  return { repository, getSuppliers: new GetSuppliersHandler(repository), createSupplier: new CreateSupplierHandler(repository), updateSupplier: new UpdateSupplierHandler(repository), canWrite: parsed.VITE_PRODUCT_READ_SOURCE === 'memory' || controlled, ids: new UuidGenerator() };
}

export const suppliersComposition = createSuppliersComposition();
