import type { SupplierRepository } from '../../ports/supplier-repository';

export class GetSuppliersHandler {
  public constructor(private readonly repository: SupplierRepository) {}
  public execute() { return this.repository.list(); }
}
