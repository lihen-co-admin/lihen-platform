import type { Supplier } from '../domain/supplier';
import type { SupplierRepository } from '../ports/supplier-repository';

export class InMemorySupplierRepository implements SupplierRepository {
  private readonly rows = new Map<string, Supplier>();
  public constructor(seed: readonly Supplier[] = []) { for (const row of seed) this.rows.set(row.id, row); }
  public async list() { return [...this.rows.values()]; }
  public async getById(id: string) { return this.rows.get(id) ?? null; }
  public async findByNormalizedName(name: string) { return [...this.rows.values()].find((x) => x.normalizedName === name) ?? null; }
  public async create(_operationKey: string, supplier: Supplier) { if ([...this.rows.values()].some((x) => x.normalizedName === supplier.normalizedName)) throw new Error('SUPPLIER_ALREADY_EXISTS'); this.rows.set(supplier.id, supplier); return supplier; }
  public async update(_operationKey: string, supplier: Supplier) { if (!this.rows.has(supplier.id)) throw new Error('SUPPLIER_NOT_FOUND'); this.rows.set(supplier.id, supplier); return supplier; }
}
