import type { Product } from '../domain/product';
import type { ProductSalePriceChange } from '../domain/product-sale-price-change';
import type { ProductPriceWriteContext, ProductPricingRepository, ProductSalePriceWriteResult } from '../ports/product-pricing-repository';
import type { ProductRepository } from '../ports/product-repository';

export class InMemoryProductRepository implements ProductRepository, ProductPricingRepository {
  private readonly products: Product[];
  private readonly salePriceHistory: ProductSalePriceChange[];

  public constructor(
    products: readonly Product[] = [],
    salePriceHistory: readonly ProductSalePriceChange[] = [],
  ) {
    this.products = [...products];
    this.salePriceHistory = [...salePriceHistory];
  }

  public async findAll(): Promise<readonly Product[]> {
    return [...this.products];
  }

  public async findById(id: string): Promise<Product | null> {
    return this.products.find((product) => product.id === id) ?? null;
  }

  public async findBySku(sku: string): Promise<Product | null> {
    const normalized = sku.trim().toUpperCase();
    return this.products.find((product) => product.sku?.trim().toUpperCase() === normalized) ?? null;
  }

  public async findByCatalogCode(catalogCode: string): Promise<Product | null> {
    const normalized = catalogCode.trim().toUpperCase();
    return this.products.find(
      (product) => product.catalogCode?.trim().toUpperCase() === normalized,
    ) ?? null;
  }

  public async create(product: Product): Promise<Product> {
    this.products.push(product);
    return product;
  }

  public async update(product: Product): Promise<Product> {
    const index = this.products.findIndex((candidate) => candidate.id === product.id);
    if (index === -1) {
      throw new Error(`Product ${product.id} was not found in memory.`);
    }

    this.products[index] = product;
    return product;
  }

  public async changeSalePrice(
    product: Product,
    historyEntry: ProductSalePriceChange,
    _context?: ProductPriceWriteContext,
  ): Promise<ProductSalePriceWriteResult> {
    const index = this.products.findIndex((candidate) => candidate.id === product.id);
    if (index === -1) {
      throw new Error(`Product ${product.id} was not found in memory.`);
    }

    // En memoria ambas mutaciones se realizan juntas dentro de la misma operación síncrona.
    this.products[index] = product;
    this.salePriceHistory.push(historyEntry);
    return { product, historyEntry };
  }

  public async findSalePriceHistoryByProductId(
    productId: string,
  ): Promise<readonly ProductSalePriceChange[]> {
    return this.salePriceHistory
      .filter((entry) => entry.productId === productId)
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
  }
}
