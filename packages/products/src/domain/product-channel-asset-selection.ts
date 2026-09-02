import type { ProductAsset } from './product-asset';

export type ProductAssetChannel =
  | 'CATALOG_PDF'
  | 'WEB_CARD'
  | 'WEB_DETAIL';

export interface ProductChannelAssetSelectionProps {
  readonly productId: string;
  readonly channel: ProductAssetChannel;
  readonly assetIds: readonly string[];
}

export class ProductChannelAssetSelection {
  public readonly productId: string;
  public readonly channel: ProductAssetChannel;
  public readonly assetIds: readonly string[];

  public constructor(props: ProductChannelAssetSelectionProps) {
    const productId = props.productId.trim();
    if (!productId) {
      throw new Error('Product channel asset selection productId is required.');
    }

    const assetIds = props.assetIds.map((id) => id.trim());
    if (assetIds.some((id) => !id)) {
      throw new Error('Product channel asset selection assetId is required.');
    }

    if (new Set(assetIds).size !== assetIds.length) {
      throw new Error('Product channel asset selection cannot contain duplicate assetIds.');
    }

    if (props.channel === 'CATALOG_PDF' && assetIds.length !== 1) {
      throw new Error('CATALOG_PDF requires exactly one selected asset.');
    }

    if (props.channel === 'WEB_CARD' && assetIds.length > 1) {
      throw new Error('WEB_CARD supports at most one selected asset.');
    }

    this.productId = productId;
    this.channel = props.channel;
    this.assetIds = Object.freeze([...assetIds]);
  }
}

export function assertChannelAssetSelectionAgainstAssets(
  selection: ProductChannelAssetSelection,
  assets: readonly ProductAsset[],
): void {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  for (const assetId of selection.assetIds) {
    const asset = byId.get(assetId);
    if (!asset) {
      throw new Error(
        `Selected asset ${assetId} does not exist in the provided Product Assets.`,
      );
    }

    if (asset.productId !== selection.productId) {
      throw new Error(
        'Selected channel assets must belong to the same productId as the selection.',
      );
    }

    if (asset.status !== 'ACTIVE') {
      throw new Error('Selected channel assets must be ACTIVE.');
    }
  }
}

/**
 * GAP-014 formalizes channel selection only.
 *
 * It does not replace source-readiness/source-selection, does not decide
 * provenance authority, and does not publish or persist the selection.
 * CATALOG_PDF is exactly one asset; Web remains policy-driven through
 * WEB_CARD and WEB_DETAIL projections.
 */
export function buildProductChannelAssetSelections(
  productId: string,
  assets: readonly ProductAsset[],
  selections: readonly ProductChannelAssetSelection[],
): readonly ProductChannelAssetSelection[] {
  const normalizedProductId = productId.trim();
  if (!normalizedProductId) {
    throw new Error('Product channel selection set productId is required.');
  }

  const seenChannels = new Set<ProductAssetChannel>();

  for (const selection of selections) {
    if (selection.productId !== normalizedProductId) {
      throw new Error('All channel selections must belong to the same productId.');
    }

    if (seenChannels.has(selection.channel)) {
      throw new Error(`Duplicate channel selection: ${selection.channel}.`);
    }
    seenChannels.add(selection.channel);

    assertChannelAssetSelectionAgainstAssets(selection, assets);
  }

  const pdfSelection = selections.find(
    (selection) => selection.channel === 'CATALOG_PDF',
  );
  if (!pdfSelection) {
    throw new Error('A CATALOG_PDF selection is required.');
  }

  return Object.freeze([...selections]);
}
