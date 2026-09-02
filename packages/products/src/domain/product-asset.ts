import { ProductImage } from './product-image';

/**
 * GAP-012 keeps ProductImage as the existing operational media entity and
 * formalizes Product -> Assets 1:N as a domain collection.
 *
 * ProductAsset is intentionally an alias in V1. This avoids creating a second
 * asset entity or a parallel source of truth while GAP-013 owns provenance
 * and GAP-014 owns channel selection.
 */
export type ProductAsset = ProductImage;

export interface ProductAssetSetProps {
  readonly productId: string;
  readonly assets?: readonly ProductAsset[];
}

export class ProductAssetSet {
  public readonly productId: string;
  private readonly assets: readonly ProductAsset[];

  public constructor(props: ProductAssetSetProps) {
    const productId = props.productId.trim();
    if (!productId) throw new Error('Product asset set productId is required.');

    const assets = [...(props.assets ?? [])];

    for (const asset of assets) {
      if (asset.productId !== productId) {
        throw new Error('All product assets must belong to the same productId.');
      }
    }

    const ids = new Set<string>();
    for (const asset of assets) {
      if (ids.has(asset.id)) {
        throw new Error('Product asset IDs must be unique within the set.');
      }
      ids.add(asset.id);
    }

    const activeGenericMain = assets.filter(
      (asset) => asset.status === 'ACTIVE' && asset.isMain,
    );
    if (activeGenericMain.length > 1) {
      throw new Error(
        'Product asset set can contain at most one ACTIVE generic main asset.',
      );
    }

    this.productId = productId;
    this.assets = Object.freeze(assets);
  }

  public active(): readonly ProductAsset[] {
    return this.assets
      .filter((asset) => asset.status === 'ACTIVE')
      .sort(compareProductAssets);
  }

  public archived(): readonly ProductAsset[] {
    return this.assets
      .filter((asset) => asset.status === 'ARCHIVED')
      .sort(compareProductAssets);
  }

  public all(): readonly ProductAsset[] {
    return [...this.assets].sort(compareProductAssets);
  }

  /**
   * Compatibility read only. Generic main is NOT PDF_SELECTED or WEB_SELECTED.
   * Channel selection belongs to GAP-014.
   */
  public genericMain(): ProductAsset | undefined {
    return this.assets.find(
      (asset) => asset.status === 'ACTIVE' && asset.isMain,
    );
  }

  public isEmpty(): boolean {
    return this.assets.length === 0;
  }

  public size(): number {
    return this.assets.length;
  }
}

function compareProductAssets(left: ProductAsset, right: ProductAsset): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }
  return left.id.localeCompare(right.id);
}
