import { createSupplier, type Supplier } from '../../domain/supplier';
import type { SupplierRepository } from '../../ports/supplier-repository';
import type { SaveSupplierCommand } from './save-supplier.command';

export class UpdateSupplierHandler {
  public constructor(private readonly repository: SupplierRepository) {}
  public async execute(command: SaveSupplierCommand): Promise<Supplier> {
    const current = await this.repository.getById(command.supplierId);
    if (!current) throw new Error('SUPPLIER_NOT_FOUND');
    const candidate = createSupplier({ id: current.id, businessName: command.businessName, contactName: command.contactName, whatsapp: command.whatsapp, email: command.email, city: command.city, averageDeliveryDays: command.averageDeliveryDays, notes: command.notes, status: command.status, now: current.createdAt });
    return this.repository.update(command.operationKey, { ...candidate, createdAt: current.createdAt, updatedAt: new Date() });
  }
}
