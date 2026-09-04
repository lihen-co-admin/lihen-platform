import {
  composeCatalogRenderModel,
  type CatalogComposerInput,
  type CatalogComposerSourceEntry,
  type CatalogRenderBusinessLine,
  type CatalogRenderInstitutionalSnapshot,
  type CatalogRenderModelVNext,
  type CatalogRenderScope,
  type CatalogRenderVersionSnapshot,
} from '@lihen/catalog';
import {
  catalogsComposition,
  type CatalogRenderEntry,
} from './catalogs';
import {
  catalogInstitutionalComposition,
  type CatalogInstitutionalContent,
} from './catalog-institutional';

export interface CatalogPdfRenderModelLoadResult {
  readonly model: CatalogRenderModelVNext | null;
  readonly stylePreviewSeed: { readonly catalogVersionId: string } | null;
}

export async function loadCatalogPdfRenderModel(
  versionId: string,
  scope: CatalogRenderScope,
): Promise<CatalogPdfRenderModelLoadResult> {
  const [entries, institutional] = await Promise.all([
    catalogsComposition.getRenderEntries(versionId),
    catalogInstitutionalComposition.getSnapshot(versionId),
  ]);

  return composeCatalogPdfRenderSnapshot(entries, institutional, scope);
}

export function composeCatalogPdfRenderSnapshot(
  entries: readonly CatalogRenderEntry[],
  institutional: CatalogInstitutionalContent | null,
  scope: CatalogRenderScope,
): CatalogPdfRenderModelLoadResult {
  const first = entries[0] ?? null;
  if (!first) {
    return Object.freeze({
      model: null,
      stylePreviewSeed: null,
    });
  }

  const input: CatalogComposerInput = {
    version: toVersionSnapshot(first),
    scope,
    entries: entries.map(toComposerSourceEntry),
    institutional: institutional
      ? toInstitutionalSnapshot(institutional)
      : null,
  };

  return Object.freeze({
    model: composeCatalogRenderModel(input).model,
    stylePreviewSeed: Object.freeze({ catalogVersionId: first.catalogVersionId }),
  });
}

function toVersionSnapshot(
  entry: CatalogRenderEntry,
): CatalogRenderVersionSnapshot {
  return {
    catalogVersionId: entry.catalogVersionId,
    catalogCode: entry.catalogCode,
    catalogTitle: entry.catalogTitle,
    versionLabel: entry.versionLabel,
    catalogStatus: entry.catalogStatus,
  };
}

function toComposerSourceEntry(
  entry: CatalogRenderEntry,
): CatalogComposerSourceEntry {
  return {
    catalogEntryId: entry.catalogEntryId,
    catalogVersionId: entry.catalogVersionId,
    productId: entry.productId,
    sku: entry.sku,
    productCatalogCode: entry.productCatalogCode,
    slug: entry.slug,
    productName: entry.productName,
    businessLine: toBusinessLine(entry.businessLine),
    brandId: null,
    brandName: entry.brand,
    category: entry.category,
    subcategory: entry.subcategory,
    description: entry.description,
    salePriceSnapshot: entry.salePrice,
    legacyImageUrl: entry.imageUrl,
    legacyImageAlt: entry.imageAlt,
    sortOrder: entry.sortOrder,
  };
}

function toBusinessLine(value: string): CatalogRenderBusinessLine {
  if (value === 'BEAUTY_CARE' || value === 'STYLE') {
    return value;
  }

  throw new Error(
    `Catalog PDF Render Model does not support business line ${value}.`,
  );
}

function toInstitutionalSnapshot(
  content: CatalogInstitutionalContent,
): CatalogRenderInstitutionalSnapshot {
  return {
    aboutTitle: content.aboutTitle,
    aboutBody: content.aboutBody,
    aboutImageUrl: nullable(content.aboutImageUrl),
    purchaseTitle: content.purchaseTitle,
    purchaseIntro: content.purchaseIntro,
    purchaseSections: content.purchaseSections.map((item) => ({
      key: item.key,
      label: item.label,
      body: item.body,
    })),
    legalName: content.legalName,
    taxId: nullable(content.taxId),
    locationText: nullable(content.locationText),
    paymentTitle: content.paymentTitle,
    paymentMethods: content.paymentMethods.map((item) => ({
      id: item.id,
      label: item.label,
      identifier: item.identifier,
      qrSourceType: item.qrSourceType,
      qrValue: item.qrValue,
      enabled: item.enabled,
      sortOrder: item.sortOrder,
    })),
    connectTitle: content.connectTitle,
    connectMessage: content.connectMessage,
    channels: {
      storefrontUrl: content.channels.storefrontUrl,
      whatsappUrl: content.channels.whatsappUrl,
      instagramUrl: content.channels.instagramUrl,
      tiktokUrl: content.channels.tiktokUrl,
      facebookUrl: content.channels.facebookUrl,
      whatsappCommunityUrl: content.channels.whatsappCommunityUrl,
    },
    footerLabel: content.footerLabel,
    capturedAt: content.updatedAt,
  };
}

function nullable(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export const catalogPdfRenderModelComposition = {
  load: loadCatalogPdfRenderModel,
};
