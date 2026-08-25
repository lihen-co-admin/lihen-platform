export type ProductImageSourceType =
  | 'MANUAL'
  | 'LEGACY_MAIN_IMAGE_URL'
  | 'STORAGE'
  | 'ORIGINAL'
  | 'OFFICIAL_WEB'
  | 'SUPPLIER_PDF'
  | 'CATALOG_EVIDENCE_CROP'
  | 'VERIFIED_EXTERNAL'
  | 'HUMAN_PROVIDED';

export type ProductImageStatus = 'ACTIVE' | 'ARCHIVED';

export type ProductImageAssetRole =
  | 'MASTER_COPY'
  | 'PUBLISHED_PRIMARY'
  | 'DERIVATIVE';

export type ProductImageDerivativeProfile =
  | 'WEB_CARD'
  | 'WEB_DETAIL'
  | 'CATALOG_PDF';

export interface ProductImageProps {
  readonly id: string;
  readonly productId: string;
  readonly publicUrl: string;
  readonly altText?: string;
  readonly isMain: boolean;
  readonly sortOrder: number;
  readonly sourceType: ProductImageSourceType;
  readonly status?: ProductImageStatus;
  readonly sourceId?: string;
  readonly assetRole?: ProductImageAssetRole;
  readonly derivativeProfile?: ProductImageDerivativeProfile;
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
  public readonly sourceId: string | undefined;
  public readonly assetRole: ProductImageAssetRole;
  public readonly derivativeProfile: ProductImageDerivativeProfile | undefined;

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
    this.sourceId = props.sourceId?.trim() || undefined;
    this.assetRole = props.assetRole ?? 'DERIVATIVE';
    this.derivativeProfile = props.derivativeProfile;
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
      ...(this.sourceId ? { sourceId: this.sourceId } : {}),
      assetRole: this.assetRole,
      ...(this.derivativeProfile ? { derivativeProfile: this.derivativeProfile } : {}),
    });
  }
}
