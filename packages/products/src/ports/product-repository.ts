import type { Product } from '../domain/product';

export interface ProductWriteContext {
  readonly actorId: string;
  readonly operationKey: string;
}

export interface ProductRepository {
  findAll(): Promise<readonly Product[]>;
  findById(id: string): Promise<Product | null>;
  findBySku(sku: string): Promise<Product | null>;
  findByCatalogCode(catalogCode: string): Promise<Product | null>;
  create(product: Product, context?: ProductWriteContext): Promise<Product>;
  update(product: Product, context?: ProductWriteContext): Promise<Product>;
}
