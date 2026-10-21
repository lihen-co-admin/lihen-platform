import { SystemClock, UuidGenerator } from '@lihen/core';
import { isPilotProduct, isPilotProductId, pilotScopeEnabled } from '../domain/product-pilot-scope';
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
  SupabaseProductImageStorage,
  PRODUCT_IMAGE_WEB_MAX_BYTES,
  UpdateProductHandler,
  type BrandRepository,
  type CategoryRepository,
  type ProductImageRepository,
  type ProductPricingRepository,
  type ProductRepository,
} from '@lihen/products';
import { Money } from '@lihen/shared';

const developmentBrands = [
  new Brand({
    id: 'brand-demo-beauty',
    name: 'Marca Beauty Demo',
    normalizedName: 'marca beauty demo',
    status: 'ACTIVE',
  }),
  new Brand({
    id: 'brand-demo-style',
    name: 'Marca Style Demo',
    normalizedName: 'marca style demo',
    status: 'ACTIVE',
  }),
] as const;

const developmentCategories = [
  new Category({
    id: 'category-beauty-care',
    name: 'Beauty Care',
    normalizedName: 'beauty care',
    businessLine: 'BEAUTY_CARE',
    status: 'ACTIVE',
  }),
  new Category({
    id: 'category-style',
    name: 'Style',
    normalizedName: 'style',
    businessLine: 'STYLE',
    status: 'ACTIVE',
  }),
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
  readonly canUploadWebp: boolean;
  readonly uploadProductWebp: (
    productId: string,
    file: File,
    ownerId: string,
  ) => Promise<{
    readonly imageId: string;
    readonly sha256: string;
    readonly operationKey: string;
    readonly ownerId: string;
  }>;
  readonly registerProductWebp: (input: {
    productId: string;
    imageId: string;
    sha256: string;
    operationKey: string;
    ownerId: string;
    altText: string;
    makeMain: boolean;
  }) => Promise<void>;
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
  const pilotWriteScope = pilotScopeEnabled(env);
  const controlledCreateEnabled = parsedEnv.VITE_PRODUCT_WRITE_MODE === 'controlled';
  const controlledUpdateEnabled = parsedEnv.VITE_PRODUCT_UPDATE_WRITE_MODE === 'controlled';
  const controlledPriceChangeEnabled = parsedEnv.VITE_PRODUCT_PRICE_WRITE_MODE === 'controlled';
  const priceHistoryReadEnabled = parsedEnv.VITE_PRODUCT_PRICE_HISTORY_READ_MODE === 'controlled';
  const productImagesReadEnabled = parsedEnv.VITE_PRODUCT_IMAGES_READ_MODE === 'controlled';
  const productImageWriteEnabled = parsedEnv.VITE_PRODUCT_IMAGE_WRITE_MODE === 'controlled';
  // Explicit independent opt-in. Never enabled by image-read configuration.
  const webpStorageEnabled =
    env.VITE_PRODUCT_WEBP_STORAGE_WRITE_MODE === 'controlled' &&
    parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase';

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
  if (pilotWriteScope) {
    const changeSalePrice = repository.changeSalePrice.bind(repository);
    repository.changeSalePrice = async (product, history, context) => {
      if (!isPilotProduct(product)) throw new Error('PILOT_PRODUCT_OUTSIDE_SCOPE');
      return changeSalePrice(product, history, context);
    };
    const create = repository.create.bind(repository),
      update = repository.update.bind(repository);
    repository.create = async (product, context) => {
      if (!isPilotProduct(product)) throw new Error('PILOT_CREATE_OUTSIDE_SCOPE');
      return create(product, context);
    };
    repository.update = async (product, context) => {
      if (!isPilotProduct(product)) throw new Error('PILOT_PRODUCT_OUTSIDE_SCOPE');
      const current = await repository.findById(product.id);
      if (!current || current.name !== product.name) throw new Error('PILOT_NAME_REVIEW_REQUIRED');
      return update(product, context);
    };
  }

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
  if (pilotWriteScope) {
    const add = imageRepository.add.bind(imageRepository),
      setMain = imageRepository.setMain.bind(imageRepository);
    imageRepository.add = async (image, operationKey) => {
      if (!isPilotProductId(image.productId)) throw new Error('PILOT_PRODUCT_OUTSIDE_SCOPE');
      return add(image, operationKey);
    };
    imageRepository.setMain = async (productId, imageId, operationKey) => {
      if (!isPilotProductId(productId)) throw new Error('PILOT_PRODUCT_OUTSIDE_SCOPE');
      return setMain(productId, imageId, operationKey);
    };
  }
  const webpStore =
    parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase'
      ? new SupabaseProductImageStorage(getBrowserSupabaseClient(env), {
          originalUploadEnabled: false,
          webDerivativeUploadEnabled: webpStorageEnabled,
        })
      : null;

  async function uploadProductWebp(
    productId: string,
    file: File,
    ownerId: string,
  ): Promise<{
    readonly imageId: string;
    readonly sha256: string;
    readonly operationKey: string;
    readonly ownerId: string;
  }> {
    if (pilotWriteScope && !isPilotProductId(productId))
      throw new Error('PILOT_PRODUCT_OUTSIDE_SCOPE');
    if (!webpStorageEnabled || !webpStore) throw new Error('WEBP_STORAGE_WRITE_BLOCKED');
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(productId)) throw new Error('Invalid product ID');
    if (file.type !== 'image/webp' || file.size <= 0 || file.size > PRODUCT_IMAGE_WEB_MAX_BYTES) {
      throw new Error('WebP inválido o superior a 3 MB.');
    }
    const client = getBrowserSupabaseClient(env);
    const { data, error } = await client.auth.getUser();
    if (error) throw new Error(`No se pudo confirmar el usuario autenticado: ${error.message}`);
    if (!data.user || data.user.id !== ownerId) {
      throw new Error('La sesión cambió; vuelve a iniciar el guardado con el usuario autorizado.');
    }

    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const sha256 = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    const imageId = crypto.randomUUID();
    const operationKey = crypto.randomUUID();
    const asset = await webpStore.uploadWebDerivative({
      productId,
      imageId,
      sha256,
      mimeType: 'image/webp',
      byteSize: file.size,
      body: file,
    });
    if (!asset.publicUrl) throw new Error('Storage no devolvió URL pública verificable.');
    return { imageId, sha256, operationKey, ownerId };
  }

  async function registerProductWebp(input: {
    productId: string;
    imageId: string;
    sha256: string;
    operationKey: string;
    ownerId: string;
    altText: string;
    makeMain: boolean;
  }): Promise<void> {
    if (pilotWriteScope && !isPilotProductId(input.productId))
      throw new Error('PILOT_PRODUCT_OUTSIDE_SCOPE');
    if (!webpStorageEnabled) throw new Error('WEBP_STORAGE_WRITE_BLOCKED');
    const client = getBrowserSupabaseClient(env);
    const { data, error: authError } = await client.auth.getUser();
    if (authError)
      throw new Error(`No se pudo confirmar el usuario autenticado: ${authError.message}`);
    if (!data.user || data.user.id !== input.ownerId) {
      throw new Error('La sesión cambió; solo el usuario que subió el WebP puede registrarlo.');
    }
    const { error } = await client.rpc('add_product_webp_image_controlled', {
      p_operation_key: input.operationKey,
      p_image_id: input.imageId,
      p_product_id: input.productId,
      p_sha256: input.sha256,
      p_alt_text: input.altText,
      p_make_main: input.makeMain,
    });
    if (error) throw new Error(`El registro WebP fue rechazado: ${error.message}`);
  }

  const ids = new UuidGenerator();

  return {
    source: parsedEnv.VITE_PRODUCT_READ_SOURCE,
    canCreate:
      !pilotWriteScope &&
      (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'memory' ||
        (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase' && controlledCreateEnabled)),
    canUpdate:
      parsedEnv.VITE_PRODUCT_READ_SOURCE === 'memory' ||
      (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase' && controlledUpdateEnabled),
    canChangePrice:
      parsedEnv.VITE_PRODUCT_READ_SOURCE === 'memory' ||
      (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase' && controlledPriceChangeEnabled),
    canReadPriceHistory:
      parsedEnv.VITE_PRODUCT_READ_SOURCE === 'memory' ||
      (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase' && priceHistoryReadEnabled),
    canManageImages:
      parsedEnv.VITE_PRODUCT_READ_SOURCE === 'memory' ||
      (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase' && productImageWriteEnabled),
    canReadImages:
      parsedEnv.VITE_PRODUCT_READ_SOURCE === 'memory' ||
      (parsedEnv.VITE_PRODUCT_READ_SOURCE === 'supabase' && productImagesReadEnabled),
    canUploadWebp: webpStorageEnabled,
    uploadProductWebp,
    registerProductWebp,
    canReadCanonicalTaxonomy: true,
    repository,
    brandRepository,
    categoryRepository,
    getProducts: new GetProductsHandler(repository, brandRepository, categoryRepository),
    getProductById: new GetProductByIdHandler(repository, brandRepository, categoryRepository),
    getBrands: new GetBrandsHandler(brandRepository),
    getCategories: new GetCategoriesHandler(categoryRepository),
    createProduct: new CreateProductHandler(repository, ids, brandRepository, categoryRepository),
    updateProduct: new UpdateProductHandler(repository, brandRepository, categoryRepository),
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
