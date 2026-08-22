import type { SupabaseClient } from '@supabase/supabase-js';
import type { Supplier } from '../domain/supplier';
import type { SupplierRepository } from '../ports/supplier-repository';

interface Options { readonly controlledWriteEnabled?: boolean; }

function mapSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: String(row.id), businessName: String(row.business_name), normalizedName: String(row.normalized_name),
    contactName: row.contact_name ? String(row.contact_name) : null, whatsapp: row.whatsapp ? String(row.whatsapp) : null,
    email: row.email ? String(row.email) : null, city: row.city ? String(row.city) : null,
    averageDeliveryDays: row.average_delivery_days == null ? null : Number(row.average_delivery_days),
    notes: row.notes ? String(row.notes) : null, status: String(row.status) as Supplier['status'],
    createdAt: new Date(String(row.created_at)), updatedAt: new Date(String(row.updated_at)),
  };
}

export class SupabaseSupplierRepository implements SupplierRepository {
  private readonly controlledWriteEnabled: boolean;
  public constructor(private readonly client: SupabaseClient, options: Options = {}) { this.controlledWriteEnabled = options.controlledWriteEnabled ?? false; }
  public async list(): Promise<readonly Supplier[]> {
    const { data, error } = await this.client.from('suppliers').select('*').order('business_name');
    if (error) throw new Error(`Unable to read suppliers: ${error.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(mapSupplier);
  }
  public async getById(id: string): Promise<Supplier | null> {
    const { data, error } = await this.client.from('suppliers').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Unable to read supplier: ${error.message}`);
    return data ? mapSupplier(data as Record<string, unknown>) : null;
  }
  public async findByNormalizedName(normalizedName: string): Promise<Supplier | null> {
    const { data, error } = await this.client.from('suppliers').select('*').eq('normalized_name', normalizedName).maybeSingle();
    if (error) throw new Error(`Unable to find supplier: ${error.message}`);
    return data ? mapSupplier(data as Record<string, unknown>) : null;
  }
  public create(operationKey: string, supplier: Supplier): Promise<Supplier> { return this.write('create_supplier_controlled', operationKey, supplier); }
  public update(operationKey: string, supplier: Supplier): Promise<Supplier> { return this.write('update_supplier_controlled', operationKey, supplier); }
  private async write(fn: 'create_supplier_controlled'|'update_supplier_controlled', operationKey: string, supplier: Supplier): Promise<Supplier> {
    if (!this.controlledWriteEnabled) throw new Error('SUPPLIER_WRITE_BLOCKED');
    const args = fn === 'create_supplier_controlled'
      ? { p_operation_key: operationKey, p_id: supplier.id, p_business_name: supplier.businessName, p_contact_name: supplier.contactName, p_whatsapp: supplier.whatsapp, p_email: supplier.email, p_city: supplier.city, p_average_delivery_days: supplier.averageDeliveryDays, p_notes: supplier.notes, p_status: supplier.status }
      : { p_operation_key: operationKey, p_supplier_id: supplier.id, p_business_name: supplier.businessName, p_contact_name: supplier.contactName, p_whatsapp: supplier.whatsapp, p_email: supplier.email, p_city: supplier.city, p_average_delivery_days: supplier.averageDeliveryDays, p_notes: supplier.notes, p_status: supplier.status };
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw new Error(`Unable to save supplier: ${error.message}`);
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (!row) throw new Error('Controlled supplier RPC returned no result.');
    return mapSupplier(row);
  }
}
