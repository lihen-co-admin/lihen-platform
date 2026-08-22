import { createSupplier, type Supplier } from '../../domain/supplier';
import type { SupplierRepository } from '../../ports/supplier-repository';
import type { SaveSupplierCommand } from './save-supplier.command';

export class CreateSupplierHandler {
  public constructor(private readonly repository: SupplierRepository) {}
  public async execute(command: SaveSupplierCommand): Promise<Supplier> {
    const candidate = createSupplier({ id: command.supplierId, businessName: command.businessName, contactName: command.contactName, whatsapp: command.whatsapp, email: command.email, city: command.city, averageDeliveryDays: command.averageDeliveryDays, notes: command.notes, status: command.status });
    return this.repository.create(command.operationKey, candidate);
  }
}
