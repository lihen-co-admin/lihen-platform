import { DomainError } from '@lihen/core';

export class DuplicateProductSkuError extends DomainError {
  public constructor(sku: string) {
    super('DUPLICATE_PRODUCT_SKU', `A product with SKU ${sku} already exists.`);
  }
}

export class DuplicateCatalogCodeError extends DomainError {
  public constructor(catalogCode: string) {
    super('DUPLICATE_CATALOG_CODE', `A product with catalog code ${catalogCode} already exists.`);
  }
}

export class ProductWriteBlockedError extends DomainError {
  public constructor() {
    super(
      'PRODUCT_WRITE_BLOCKED',
      'Supabase product writes are blocked until the DEV schema and RLS precheck is approved.',
    );
  }
}

export class ProductNotFoundError extends DomainError {
  public constructor(productId: string) {
    super('PRODUCT_NOT_FOUND', `Product ${productId} was not found.`);
  }
}

export class ProductSalePriceUnchangedError extends DomainError {
  public constructor(price: number) {
    super('PRODUCT_SALE_PRICE_UNCHANGED', `The sale price is already ${price}.`);
  }
}

export class ProductPriceHistoryUnavailableError extends DomainError {
  public constructor() {
    super(
      'PRODUCT_PRICE_HISTORY_UNAVAILABLE',
      'Product price history is not available from Supabase until its DEV schema is created and validated.',
    );
  }
}

export class ProductImageWriteBlockedError extends DomainError {
  public constructor() {
    super(
      'PRODUCT_IMAGE_WRITE_BLOCKED',
      'Supabase product image writes are blocked until DEV schema, RLS, and Storage policies are approved.',
    );
  }
}

export class ProductImageNotFoundError extends DomainError {
  public constructor(imageId: string) {
    super('PRODUCT_IMAGE_NOT_FOUND', `Product image ${imageId} was not found.`);
  }
}

export class BrandNotFoundError extends DomainError { public constructor(brandId:string){ super('BRAND_NOT_FOUND', `Brand ${brandId} was not found.`); } }
export class CategoryNotFoundError extends DomainError { public constructor(categoryId:string){ super('CATEGORY_NOT_FOUND', `Category ${categoryId} was not found.`); } }


export class ProductCreateForbiddenError extends DomainError {
  public constructor() {
    super(
      'PRODUCT_CREATE_FORBIDDEN',
      'The authenticated LIHEN profile is not authorized to create products.',
    );
  }
}


export class ProductUpdateForbiddenError extends DomainError {
  public constructor() {
    super(
      'PRODUCT_UPDATE_FORBIDDEN',
      'The authenticated LIHEN profile is not authorized to update products.',
    );
  }
}

export class ProductWriteOperationConflictError extends DomainError {
  public constructor(operationKey: string) {
    super(
      'PRODUCT_WRITE_OPERATION_CONFLICT',
      `The product write operation key ${operationKey} has already been used by another operation.`,
    );
  }
}


export class ProductPriceChangeForbiddenError extends DomainError {
  public constructor() {
    super(
      'PRODUCT_PRICE_CHANGE_FORBIDDEN',
      'The authenticated LIHEN profile is not authorized to change product prices.',
    );
  }
}


export class ProductPriceHistoryReadForbiddenError extends DomainError {
  public constructor() {
    super(
      'PRODUCT_PRICE_HISTORY_READ_FORBIDDEN',
      'The authenticated LIHEN profile is not authorized to read product price history.',
    );
  }
}


export class ProductImagesUnavailableError extends DomainError {
  public constructor() {
    super('PRODUCT_IMAGES_UNAVAILABLE', 'Product images are not available from Supabase until the controlled image-read gate is enabled.');
  }
}

export class ProductImagesReadForbiddenError extends DomainError {
  public constructor() {
    super('PRODUCT_IMAGES_READ_FORBIDDEN', 'The authenticated LIHEN profile is not authorized to read product images.');
  }
}


export class ProductImageWriteForbiddenError extends DomainError {
  public constructor() {
    super(
      'PRODUCT_IMAGE_WRITE_FORBIDDEN',
      'The authenticated LIHEN profile is not authorized to modify product images.',
    );
  }
}

export class ProductImageWriteOperationConflictError extends DomainError {
  public constructor(operationKey: string) {
    super(
      'PRODUCT_IMAGE_WRITE_OPERATION_CONFLICT',
      `The product-image write operation key ${operationKey} has already been used by another operation.`,
    );
  }
}

export class ProductImageIdConflictError extends DomainError {
  public constructor(imageId: string) {
    super('PRODUCT_IMAGE_ID_CONFLICT', `Product image id ${imageId} already exists.`);
  }
}

export class ProductImageStorageWriteBlockedError extends Error {
  public constructor() {
    super('Product image Storage uploads are blocked until an explicit Storage cutover.');
    this.name = 'ProductImageStorageWriteBlockedError';
  }
}
