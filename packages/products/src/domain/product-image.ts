export type ProductImageSourceType = 'MANUAL' | 'LEGACY_MAIN_IMAGE_URL' | 'STORAGE';
export type ProductImageStatus = 'ACTIVE' | 'ARCHIVED';

export interface ProductImageProps {
  readonly id: string;
  readonly productId: string;
  readonly publicUrl: string;
  readonly altText?: string;
  readonly isMain: boolean;
  readonly sortOrder: number;
  readonly sourceType: ProductImageSourceType;
  readonly status?: ProductImageStatus;
}

export class ProductImage {
  public readonly id: string;
  public readonly productId: string;
  public readonly publicUrl: string;
  public readonly altText: string | undefined;
  public readonly isMain: boolean;
  public readonly sortOrder: number;
  public readonly sourceType: ProductImageSourceType;
  public readonly status: ProductImageStatus;

  public constructor(props: ProductImageProps) {
    if (!props.productId.trim()) throw new Error('Product image productId is required.');
    if (!props.publicUrl.trim()) throw new Error('Product image publicUrl is required.');
    if (!Number.isInteger(props.sortOrder) || props.sortOrder < 0) {
      throw new Error('Product image sortOrder must be a non-negative integer.');
    }

    this.id = props.id;
    this.productId = props.productId;
    this.publicUrl = props.publicUrl.trim();
    this.altText = props.altText?.trim() || undefined;
    this.isMain = props.isMain;
    this.sortOrder = props.sortOrder;
    this.sourceType = props.sourceType;
    this.status = props.status ?? 'ACTIVE';
  }

  public withMain(isMain: boolean): ProductImage {
    return new ProductImage({
      id: this.id,
      productId: this.productId,
      publicUrl: this.publicUrl,
      ...(this.altText ? { altText: this.altText } : {}),
      isMain,
      sortOrder: this.sortOrder,
      sourceType: this.sourceType,
      status: this.status,
    });
  }
}
