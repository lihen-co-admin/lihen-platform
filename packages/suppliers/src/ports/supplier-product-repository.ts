import type { SupplierProduct } from '../domain/supplier-product';

export interface SupplierProductRepository {
  listBySupplierId(supplierId: string): Promise<readonly SupplierProduct[]>;
  listByProductId(productId: string): Promise<readonly SupplierProduct[]>;
  getBySupplierAndProduct(
    supplierId: string,
    productId: string,
  ): Promise<SupplierProduct | null>;
}
