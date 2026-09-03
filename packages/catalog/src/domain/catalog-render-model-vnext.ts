export const CATALOG_RENDER_MODEL_VNEXT_SCHEMA =
  'CATALOG_RENDER_MODEL_VNEXT_1' as const;

export type CatalogRenderModelVNextSchema =
  typeof CATALOG_RENDER_MODEL_VNEXT_SCHEMA;

export type CatalogRenderBusinessLine = 'BEAUTY_CARE' | 'STYLE';
export type CatalogRenderScope = 'ALL' | CatalogRenderBusinessLine;

export type CatalogRenderAssetResolutionSource =
  | 'CHANNEL_SELECTION'
  | 'LEGACY_RENDER_PROJECTION';

export type CatalogRenderBrandVisualSource =
  | 'CANONICAL_BRAND_ASSET'
  | 'LEGACY_COMPATIBILITY'
  | 'TEXT_ONLY';

export interface CatalogRenderVersionSnapshot {
  readonly catalogVersionId: string;
  readonly catalogCode: string;
  readonly catalogTitle: string;
  readonly versionLabel: string;
  readonly catalogStatus: string;
}

export interface CatalogRenderPdfAssetSnapshot {
  readonly assetId: string | null;
  readonly publicUrl: string;
  readonly altText: string | null;
  readonly sourceId: string | null;
  readonly resolutionSource: CatalogRenderAssetResolutionSource;
}

export interface CatalogRenderBrandVisualSnapshot {
  readonly source: CatalogRenderBrandVisualSource;
  readonly assetId: string | null;
  readonly publicUrl: string | null;
  readonly kind: 'LOGO' | 'WORDMARK' | 'ISOTYPE' | 'LOCKUP' | null;
  readonly approvalMode:
    | 'MANUAL_VERIFIED'
    | 'AUTO_VERIFIED'
    | 'CANDIDATE'
    | 'REQUIRES_REVIEW'
    | null;
}

export interface CatalogRenderBrandSnapshot {
  readonly brandId: string | null;
  readonly name: string;
  readonly visual: CatalogRenderBrandVisualSnapshot;
}

export interface CatalogRenderProductSnapshot {
  readonly catalogEntryId: string;
  readonly catalogVersionId: string;
  readonly productId: string;
  readonly sku: string | null;
  readonly productCatalogCode: string | null;
  readonly slug: string;
  readonly productName: string;
  readonly businessLine: CatalogRenderBusinessLine;
  readonly brand: CatalogRenderBrandSnapshot;
  readonly category: string | null;
  readonly subcategory: string | null;
  readonly description: string | null;
  readonly salePriceSnapshot: number;
  readonly selectedPdfAsset: CatalogRenderPdfAssetSnapshot;
  readonly sortOrder: number;
}

export interface CatalogRenderPurchaseSection {
  readonly key: string;
  readonly label: string;
  readonly body: string;
}

export interface CatalogRenderPaymentMethod {
  readonly id: string;
  readonly label: string;
  readonly identifier: string;
  readonly qrSourceType: 'URL' | 'PAYLOAD' | 'IMAGE';
  readonly qrValue: string;
  readonly enabled: boolean;
  readonly sortOrder: number;
}

export interface CatalogRenderChannels {
  readonly storefrontUrl: string;
  readonly whatsappUrl: string;
  readonly instagramUrl: string;
  readonly tiktokUrl: string;
  readonly facebookUrl: string;
  readonly whatsappCommunityUrl: string;
}

export interface CatalogRenderInstitutionalSnapshot {
  readonly aboutTitle: string;
  readonly aboutBody: string;
  readonly aboutImageUrl: string | null;
  readonly purchaseTitle: string;
  readonly purchaseIntro: string;
  readonly purchaseSections: readonly CatalogRenderPurchaseSection[];
  readonly legalName: string;
  readonly taxId: string | null;
  readonly locationText: string | null;
  readonly paymentTitle: string;
  readonly paymentMethods: readonly CatalogRenderPaymentMethod[];
  readonly connectTitle: string;
  readonly connectMessage: string;
  readonly channels: CatalogRenderChannels;
  readonly footerLabel: string;
  readonly capturedAt: string | null;
}

export interface CatalogRenderModelVNextProps {
  readonly version: CatalogRenderVersionSnapshot;
  readonly scope: CatalogRenderScope;
  readonly entries: readonly CatalogRenderProductSnapshot[];
  readonly institutional: CatalogRenderInstitutionalSnapshot | null;
}

export class CatalogRenderModelVNext {
  public readonly schemaVersion: CatalogRenderModelVNextSchema =
    CATALOG_RENDER_MODEL_VNEXT_SCHEMA;
  public readonly version: CatalogRenderVersionSnapshot;
  public readonly scope: CatalogRenderScope;
  public readonly entries: readonly CatalogRenderProductSnapshot[];
  public readonly institutional: CatalogRenderInstitutionalSnapshot | null;

  public constructor(props: CatalogRenderModelVNextProps) {
    validateVersion(props.version);

    const seenEntryIds = new Set<string>();
    const normalizedEntries = props.entries.map((entry) => {
      validateEntry(entry, props.version.catalogVersionId);

      if (seenEntryIds.has(entry.catalogEntryId)) {
        throw new Error(
          `Catalog Render Model cannot contain duplicate catalogEntryId ${entry.catalogEntryId}.`,
        );
      }
      seenEntryIds.add(entry.catalogEntryId);

      if (props.scope !== 'ALL' && entry.businessLine !== props.scope) {
        throw new Error(
          'Catalog Render Model entries must match the requested render scope.',
        );
      }

      return freezeEntry(entry);
    });

    normalizedEntries.sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.catalogEntryId.localeCompare(right.catalogEntryId),
    );

    this.version = Object.freeze({ ...props.version });
    this.scope = props.scope;
    this.entries = Object.freeze(normalizedEntries);
    this.institutional = props.institutional
      ? freezeInstitutional(props.institutional)
      : null;
  }
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Catalog Render Model ${field} is required.`);
  }
  return normalized;
}

function validateVersion(version: CatalogRenderVersionSnapshot): void {
  required(version.catalogVersionId, 'catalogVersionId');
  required(version.catalogCode, 'catalogCode');
  required(version.catalogTitle, 'catalogTitle');
  required(version.versionLabel, 'versionLabel');
  required(version.catalogStatus, 'catalogStatus');
}

function validateEntry(
  entry: CatalogRenderProductSnapshot,
  expectedVersionId: string,
): void {
  required(entry.catalogEntryId, 'catalogEntryId');
  required(entry.catalogVersionId, 'entry catalogVersionId');
  required(entry.productId, 'productId');
  required(entry.slug, 'slug');
  required(entry.productName, 'productName');
  required(entry.brand.name, 'brand name');

  if (entry.catalogVersionId !== expectedVersionId) {
    throw new Error(
      'Catalog Render Model entries must belong to the same catalogVersionId.',
    );
  }

  if (
    !Number.isFinite(entry.salePriceSnapshot) ||
    entry.salePriceSnapshot < 0
  ) {
    throw new Error(
      'Catalog Render Model salePriceSnapshot must be a non-negative finite number.',
    );
  }

  if (!Number.isInteger(entry.sortOrder) || entry.sortOrder < 0) {
    throw new Error(
      'Catalog Render Model sortOrder must be a non-negative integer.',
    );
  }

  required(entry.selectedPdfAsset.publicUrl, 'selected PDF asset publicUrl');

  if (
    entry.selectedPdfAsset.resolutionSource === 'CHANNEL_SELECTION' &&
    !entry.selectedPdfAsset.assetId?.trim()
  ) {
    throw new Error(
      'CHANNEL_SELECTION render assets require the selected Product Asset id.',
    );
  }

  if (
    entry.brand.visual.source === 'CANONICAL_BRAND_ASSET' &&
    (!entry.brand.visual.assetId?.trim() ||
      !entry.brand.visual.publicUrl?.trim())
  ) {
    throw new Error(
      'CANONICAL_BRAND_ASSET render visuals require assetId and publicUrl.',
    );
  }

  if (
    entry.brand.visual.source === 'TEXT_ONLY' &&
    (entry.brand.visual.assetId !== null ||
      entry.brand.visual.publicUrl !== null)
  ) {
    throw new Error(
      'TEXT_ONLY brand visuals cannot carry a Brand Asset id or publicUrl.',
    );
  }
}

function freezeEntry(
  entry: CatalogRenderProductSnapshot,
): CatalogRenderProductSnapshot {
  return Object.freeze({
    ...entry,
    brand: Object.freeze({
      ...entry.brand,
      visual: Object.freeze({ ...entry.brand.visual }),
    }),
    selectedPdfAsset: Object.freeze({ ...entry.selectedPdfAsset }),
  });
}

function freezeInstitutional(
  value: CatalogRenderInstitutionalSnapshot,
): CatalogRenderInstitutionalSnapshot {
  return Object.freeze({
    ...value,
    purchaseSections: Object.freeze(
      value.purchaseSections.map((item) => Object.freeze({ ...item })),
    ),
    paymentMethods: Object.freeze(
      [...value.paymentMethods]
        .map((item) => Object.freeze({ ...item }))
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.id.localeCompare(right.id),
        ),
    ),
    channels: Object.freeze({ ...value.channels }),
  });
}

/**
 * GAP-022 owns the renderer-ready contract only.
 *
 * The model receives already-resolved snapshots. It does not read Supabase,
 * choose Product/Brand Assets, group/page products, apply STYLE editorial
 * policy, format prices, publish, or render React. GAP-023 owns composition,
 * GAP-024 owns renderer purification, GAP-025 owns the integrity guard, and
 * GAP-026 owns STYLE editorial policy.
 *
 * LEGACY_RENDER_PROJECTION and LEGACY_COMPATIBILITY are explicit migration
 * sources; they must never be interpreted as canonical Channel Selection or
 * canonical Brand Asset approval.
 */
export function createCatalogRenderModelVNext(
  props: CatalogRenderModelVNextProps,
): CatalogRenderModelVNext {
  return new CatalogRenderModelVNext(props);
}
