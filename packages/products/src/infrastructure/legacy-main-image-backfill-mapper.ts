import { ProductImage } from '../domain/product-image';

/**
 * Converts the legacy products.main_image_url value into the canonical ProductImage model.
 * This mapper does NOT query Supabase and does NOT write Storage; it prepares the future backfill.
 */
export class LegacyMainImageBackfillMapper {
  public static toProductImage(input: {
    readonly imageId: string;
    readonly productId: string;
    readonly mainImageUrl: string;
    readonly altText?: string;
  }): ProductImage | null {
    const url = input.mainImageUrl.trim();
    if (!url) return null;

    return new ProductImage({
      id: input.imageId,
      productId: input.productId,
      publicUrl: url,
      ...(input.altText?.trim() ? { altText: input.altText.trim() } : {}),
      isMain: true,
      sortOrder: 0,
      sourceType: 'LEGACY_MAIN_IMAGE_URL',
    });
  }
}
