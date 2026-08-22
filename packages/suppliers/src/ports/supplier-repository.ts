import type { Supplier } from '../domain/supplier';

export interface SupplierRepository {
  list(): Promise<readonly Supplier[]>;
  getById(id: string): Promise<Supplier | null>;
  findByNormalizedName(normalizedName: string): Promise<Supplier | null>;
}
