import { SystemClock, UuidGenerator } from '@lihen/core';
import { getBrowserSupabaseClient, parseBrowserEnv, type ProductReadSource } from '@lihen/database';
import {
  AddProductImageHandler,
  Brand,
  Category,
  ChangeProductSalePriceHandler,
  CreateProductHandler,
  GetBrandsHandler,
  GetCategoriesHandler,
  GetProductByIdHandler,
  GetProductImagesHandler,
  GetProductSalePriceHistoryHandler,
  GetProductsHandler,
  InMemoryBrandRepository,
  InMemoryCategoryRepository,
  InMemoryProductImageRepository,
  InMemoryProductRepository,
  Product,
  SetMainProductImageHandler,
  SupabaseProductImageRepository,
  SupabaseProductRepository,
  SupabaseBrandRepository,
  SupabaseCategoryRepository,
  UpdateProductHandler,
  type BrandRepository,
  type CategoryRepository,
  type ProductImageRepository,
  type ProductPricingRepository,
  type ProductRepository,
} from '@lihen/products';
import { Money } from '@lihen/shared';

const developmentBrands = [
  new Brand({ id: 'brand-demo-beauty', name: 'Marca Beauty Demo', normalizedName: 'marca beauty demo', status: 'ACTIVE' }),
  new Brand({ id: 'brand-demo-style', name: 'Marca Style Demo', normalizedName: 'marca style demo', status: 'ACTIVE' }),
] as const;

const developmentCategories = [
  new Category({ id: 'category-beauty-care', name: 'Beauty Care', normalizedName: 'beauty care', businessLine: 'BEAUTY_CARE', status: 'ACTIVE' }),
  new Category({ id: 'category-style', name: 'Style', normalizedName: 'style', businessLine: 'STYLE', status: 'ACTIVE' }),
] as const;

const developmentProducts = [
  new Product({
    id: 'demo-bc-080',
    sku: 'BC-080',
    catalogCode: 'LIHEN-DEMO-080',
    name: 'Producto demo Beauty Care',
    businessLine: 'BEAUTY_CARE',
    brandId: 'brand-demo-beauty',
    categoryId: 'category-beauty-care',
    status: 'ACTIVE',
    salePrice: new Money(25_000, 'COP'),
  }),
  new Product({
    id: 'demo-style-001',
    sku: 'ST-001',
    catalogCode: 'LIHEN-DEMO-STYLE-001',
    name: 'Producto demo Style',
    businessLine: 'STYLE',
    brandId: 'brand-demo-style',
    categoryId: 'category-style',
    status: 'INACTIVE',
    salePrice: new Money(48_000, 'COP'),
  }),
] as const;

export interface ProductsComposition {
  readonly source: ProductReadSource;
  readonly canCreate: boolean;
  readonly canUpdate: boolean;
  readonly canChangePrice: boolean;
  readonly canReadPriceHistory: boolean;
  readonly canManageImages: boolean;
  readonly canReadImages: boolean;
  readonly canReadCanonicalTaxonomy: boolean;
  readonly repository: ProductRepository;
  readonly brandRepository: BrandRepository;
  readonly categoryRepository: CategoryRepository;
  readonly getProducts: GetProductsHandler;
  readonly getProductById: GetProductByIdHandler;
  readonly getBrands: GetBrandsHandler;
  readonly getCategories: GetCategoriesHandler;
  readonly createProduct: CreateProductHandler;
  readonly updateProduct: UpdateProductHandler;
  readonly changeProductSalePrice: ChangeProductSalePriceHandler;
  readonly getProductSalePriceHistory: GetProductSalePriceHistoryHandler;
  readonly getProductImages: GetProductImagesHandler;
  readonly addProductImage: AddProductImageHandler;
  readonly setMainProductImage: SetMainProductImageHandler;
}

export function createProductsComposition(
  env: Record<string, unknown> = import.meta.env,
): ProductsComposition {
  const parsedEnv = parseBrowserEnv(env);
  const controlledCreateEnabled = parsedEnv.VITE_PRODUCT_WRITE_MODE === 'controlled';
  const controlledUpdateEnabled = parsedEnv.VITE_PRODUCT_UPDATE_WRITE_MODE === 'controlled';
  const controlledPriceChangeEnabled = parsedEnv.VITE_PRODUCT_PRICE_WRITE_MODE === 'controlled';
  const priceHistoryReadEnabled = parsedEnv.VITE_PRODUCT_PRICE_HISTORY_READ_MODE === 'controlled';
  const productImagesReadEnabled = parsedEnv.VITE_PRODUCT_IMAGES_READ_MODE === 'controlled';
  const productImageWriteEnabled = parsedEnv.VITE_PRODUCT_IMAGE_WRITE_MODE === 'controlled';

  const repository: ProductRepository & ProductPricingRepository =
    parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase'
      ? new SupabaseProductRepository(getBrowserSupabaseClient(env), {
          controlledCreateEnabled,
          controlledUpdateEnabled,
          controlledPriceChangeEnabled,
          priceHistoryReadEnabled,
        })
      : new InMemoryProductRepository(developmentProducts);

  const brandRepository: BrandRepository =
    parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase'
      ? new SupabaseBrandRepository(getBrowserSupabaseClient(env))
      : new InMemoryBrandRepository(developmentBrands);

  const categoryRepository: CategoryRepository =
    parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase'
      ? new SupabaseCategoryRepository(getBrowserSupabaseClient(env))
      : new InMemoryCategoryRepository(developmentCategories);
  const imageRepository: ProductImageRepository =
    parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase'
      ? new SupabaseProductImageRepository(getBrowserSupabaseClient(env), {
          readEnabled: productImagesReadEnabled,
          controlledWriteEnabled: productImageWriteEnabled,
        })
      : new InMemoryProductImageRepository();

  const ids = new UuidGenerator();

  return {
    source: parsedEnv.VITE_PRODUCT_READ_SOURCE,
    canCreate:
      parsedEnv.VITE_PRODUCT_READ_SOURCE === 'memory'
      || (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase' && controlledCreateEnabled),
    canUpdate:
      parsedEnv.VITE_PRODUCT_READ_SOURCE === 'memory'
      || (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase' && controlledUpdateEnabled),
    canChangePrice:
      parsedEnv.VITE_PRODUCT_READ_SOURCE === 'memory'
      || (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase' && controlledPriceChangeEnabled),
    canReadPriceHistory:
      parsedEnv.VITE_PRODUCT_READ_SOURCE === 'memory'
      || (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase' && priceHistoryReadEnabled),
    canManageImages:
      parsedEnv.VITE_PRODUCT_READ_SOURCE === 'memory'
      || (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase' && productImageWriteEnabled),
    canReadImages:
      parsedEnv.VITE_PRODUCT_READ_SOURCE === 'memory'
      || (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase' && productImagesReadEnabled),
    canReadCanonicalTaxonomy: true,
    repository,
    brandRepository,
    categoryRepository,
    getProducts: new GetProductsHandler(repository, brandRepository, categoryRepository),
    getProductById: new GetProductByIdHandler(repository, brandRepository, categoryRepository),
    getBrands: new GetBrandsHandler(brandRepository),
    getCategories: new GetCategoriesHandler(categoryRepository),
    createProduct: new CreateProductHandler(
      repository,
      ids,
      brandRepository,
      categoryRepository,
    ),
    updateProduct: new UpdateProductHandler(
      repository,
      brandRepository,
      categoryRepository,
    ),
    changeProductSalePrice: new ChangeProductSalePriceHandler(
      repository,
      repository,
      new SystemClock(),
      ids,
    ),
    getProductSalePriceHistory: new GetProductSalePriceHistoryHandler(repository),
    getProductImages: new GetProductImagesHandler(imageRepository),
    addProductImage: new AddProductImageHandler(repository, imageRepository, ids),
    setMainProductImage: new SetMainProductImageHandler(repository, imageRepository, ids),
  };
}

export const productsComposition = createProductsComposition();
