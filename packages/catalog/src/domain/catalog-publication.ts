export const CATALOG_CHANNELS = ['PDF', 'WEB'] as const;
export type CatalogChannel = (typeof CATALOG_CHANNELS)[number];

export const CATALOG_PUBLICATION_BLOCK_REASONS = [
  'PRODUCT_NOT_ACTIVE',
  'NOT_INCLUDED_IN_VERSION',
  'INVALID_SALE_PRICE',
  'MISSING_MAIN_IMAGE',
  'WEBSITE_VISIBILITY_DISABLED',
] as const;

export type CatalogPublicationBlockReason =
  (typeof CATALOG_PUBLICATION_BLOCK_REASONS)[number];

export interface CatalogPublicationCandidate {
  readonly productId: string;
  readonly status: string;
  readonly salePrice: number;
  readonly mainImageUrl: string | null;
  readonly includedInVersion: boolean;
  readonly visibleOnWebsite: boolean;
}

export interface CatalogPublicationDecision {
  readonly channel: CatalogChannel;
  readonly publishable: boolean;
  readonly reasons: readonly CatalogPublicationBlockReason[];
}

/**
 * Evalúa solamente condiciones de publicación comercial compartidas por PDF y WEB.
 * El costo no participa: un costo faltante es una deuda de calidad de datos, no una razón
 * automática para ocultar un producto cuyo precio comercial sí está validado.
 */
export function evaluateCatalogPublication(
  candidate: CatalogPublicationCandidate,
  channel: CatalogChannel,
): CatalogPublicationDecision {
  const reasons: CatalogPublicationBlockReason[] = [];

  if (candidate.status !== 'ACTIVE') {
    reasons.push('PRODUCT_NOT_ACTIVE');
  }

  if (!candidate.includedInVersion) {
    reasons.push('NOT_INCLUDED_IN_VERSION');
  }

  if (!Number.isFinite(candidate.salePrice) || candidate.salePrice < 0) {
    reasons.push('INVALID_SALE_PRICE');
  }

  if (!candidate.mainImageUrl?.trim()) {
    reasons.push('MISSING_MAIN_IMAGE');
  }

  if (channel === 'WEB' && !candidate.visibleOnWebsite) {
    reasons.push('WEBSITE_VISIBILITY_DISABLED');
  }

  return {
    channel,
    publishable: reasons.length === 0,
    reasons,
  };
}
