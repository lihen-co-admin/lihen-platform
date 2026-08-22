import type { ProductListItemDTO } from '../dto/product-list-item.dto';
import type { ProductRepository } from '../../ports/product-repository';
import type { BrandRepository } from '../../ports/brand-repository';
import type { CategoryRepository } from '../../ports/category-repository';
import type { GetProductsQuery } from './get-products.query';

export class GetProductsHandler {
  public constructor(
    private readonly productRepository: ProductRepository,
    private readonly brands?: BrandRepository,
    private readonly categories?: CategoryRepository,
  ) {}

  public async execute(_query: GetProductsQuery): Promise<readonly ProductListItemDTO[]> {
    /*
     * Aquí se cargan productos, marcas y categorías en bloque.
     * Esto evita hacer una consulta remota por cada producto cuando
     * Supabase es la fuente configurada (problema N+1).
     */
    const [products, brands, categories] = await Promise.all([
      this.productRepository.findAll(),
      this.brands?.findAll() ?? Promise.resolve([]),
      this.categories?.findAll() ?? Promise.resolve([]),
    ]);

    const brandNames = new Map(brands.map((brand) => [brand.id, brand.name]));
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

    return products.map((product) => ({
      id: product.id,
      sku: product.sku ?? null,
      catalogCode: product.catalogCode ?? null,
      slug: product.slug,
      name: product.name,
      businessLine: product.businessLine,
      brandId: product.brandId ?? null,
      brandName: product.brandId ? (brandNames.get(product.brandId) ?? null) : null,
      categoryId: product.categoryId ?? null,
      categoryName: product.categoryId ? (categoryNames.get(product.categoryId) ?? null) : null,
      status: product.status,
      salePrice: {
        amount: product.salePrice.amount,
        currency: product.salePrice.currency,
      },
    }));
  }
}
