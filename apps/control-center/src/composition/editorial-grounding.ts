import {
  editorialIdentityKey,
  type EditorialEvidenceClassification,
  type SearchProductIdentity,
  type EditorialResearchReport,
  type EditorialResearchSource,
  type Confidence,
} from '@lihen/intelligence-core';
import type { ProductDetailDTO, ProductListItemDTO } from '@lihen/products';
import { createGetProductByIdQuery } from '@lihen/products';
import { productsComposition } from './products';
import { inventoryComposition } from './inventory';
import { readEditorialVideoAssets } from './editorial-video-assets';

export type EditorialTrust = EditorialEvidenceClassification;
export type ProductIdentity = SearchProductIdentity;
export interface EditorialFact {
  id: string;
  field: string;
  value: string;
  sourceId: string;
  trust: EditorialTrust;
  usableInCopy: boolean;
  evidenceRefs?: readonly string[];
  confidence?: Confidence;
}
export interface EditorialSource {
  id: string;
  label: string;
  trust: EditorialTrust;
  retrievedAt: string;
  url?: string;
  verification?: EditorialResearchSource;
}
export interface EditorialGrounding {
  productIdentity: ProductIdentity;
  evidence: {
    internalFacts: EditorialFact[];
    officialBrandFacts: EditorialFact[];
    secondaryFacts: EditorialFact[];
    unsupportedClaims: { field: string; status: 'INSUFFICIENT_EVIDENCE' }[];
    sources: EditorialSource[];
    externalResearch: 'NOT_CONFIGURED' | 'COMPLETED' | 'INSUFFICIENT_EVIDENCE';
    research?: EditorialResearchReport;
  };
}

export function identifyProduct(product: {
  id: string;
  name: string;
  sku?: string | null | undefined;
  brandId?: string | null | undefined;
  brandName?: string | null | undefined;
  categoryName?: string | null | undefined;
}): ProductIdentity {
  return {
    productId: product.id,
    productName: product.name,
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.brandId ? { brandId: product.brandId } : {}),
    ...(product.brandName ? { brand: product.brandName } : {}),
    ...(product.categoryName ? { category: product.categoryName } : {}),
  };
}

export function assertProductIdentity(expected: ProductIdentity, actual: ProductIdentity) {
  for (const key of ['productId', 'productName', 'sku', 'brandId', 'brand', 'category'] as const) {
    if ((expected[key] ?? '') !== (actual[key] ?? ''))
      throw new Error('EDITORIAL_PRODUCT_IDENTITY_MISMATCH');
  }
}

export function internalEditorialGrounding(
  product: ProductDetailDTO,
  retrievedAt: string,
): EditorialGrounding {
  const facts: EditorialFact[] = [];
  const add = (field: string, value: unknown, usableInCopy = false) => {
    if (typeof value === 'string' && value.trim())
      facts.push({
        id: `internal:${field}`,
        field,
        value,
        sourceId: 'product-master',
        trust: 'VERIFIED_INTERNAL',
        usableInCopy,
      });
  };
  add('name', product.name, true);
  add('sku', product.sku, true);
  add('brand', product.brandName, true);
  add('category', product.categoryName, true);
  add('catalogCode', product.catalogCode);
  add('businessLine', product.businessLine);
  add('status', product.status);
  if (product.salePrice) add('price', `${product.salePrice.amount} ${product.salePrice.currency}`);
  return {
    productIdentity: identifyProduct(product),
    evidence: {
      internalFacts: facts,
      officialBrandFacts: [],
      secondaryFacts: [],
      unsupportedClaims: [
        'description',
        'subcategory',
        'attributes',
        'ingredients',
        'benefits',
        'results',
        'usage',
        'certifications',
        'dermatologicalProperties',
        'clinicalClaims',
        'origin',
        'composition',
        'presentation',
        'discounts',
      ].map((field) => ({ field, status: 'INSUFFICIENT_EVIDENCE' })),
      sources: [
        {
          id: 'product-master',
          label: 'Catálogo LIHEN · Product Master',
          trust: 'VERIFIED_INTERNAL',
          retrievedAt,
        },
      ],
      externalResearch: 'NOT_CONFIGURED',
    },
  };
}

// Only assessment reports from the governed SearchPort boundary are accepted here.
export type VerifiedResearchRecord = EditorialResearchReport;
export function acceptResearchEvidence(
  grounding: EditorialGrounding,
  report: EditorialResearchReport,
): EditorialGrounding {
  if (editorialIdentityKey(grounding.productIdentity) !== editorialIdentityKey(report.identity))
    throw new Error('EDITORIAL_PRODUCT_IDENTITY_MISMATCH');
  const evidence = {
    ...grounding.evidence,
    internalFacts: [...grounding.evidence.internalFacts],
    officialBrandFacts: [] as EditorialFact[],
    secondaryFacts: [] as EditorialFact[],
    sources: grounding.evidence.sources.filter((source) => source.trust === 'VERIFIED_INTERNAL'),
    research: report,
    externalResearch: (report.status === 'SEARCH_PROVIDER_NOT_CONFIGURED'
      ? 'NOT_CONFIGURED'
      : report.status === 'COMPLETED'
        ? 'COMPLETED'
        : 'INSUFFICIENT_EVIDENCE') as EditorialGrounding['evidence']['externalResearch'],
  };
  if (report.status === 'COMPLETED')
    for (const source of report.sources) {
      if (evidence.sources.some((entry) => entry.id === source.id)) continue;
      const official = source.authority === 'OFFICIAL_BRAND';
      const trusted =
        source.authority !== 'UNVERIFIED' &&
        source.identityMatch === 'VERIFIED' &&
        Boolean(source.authorityEvidenceRef);
      evidence.sources.push({
        id: source.id,
        label: source.title,
        trust: trusted
          ? official
            ? 'VERIFIED_OFFICIAL_BRAND'
            : 'SUPPORTED_SECONDARY'
          : 'INSUFFICIENT_EVIDENCE',
        retrievedAt: source.retrievedAt,
        url: source.url,
        verification: source,
      });
      if (!trusted) continue;
      for (const claim of source.claims) {
        const classification = official ? 'VERIFIED_OFFICIAL_BRAND' : 'SUPPORTED_SECONDARY';
        if (
          claim.classification !== classification ||
          !claim.sources.includes(source.id) ||
          !claim.evidenceRefs.length ||
          !claim.evidenceRefs.every((ref) =>
            source.extracts.some(
              (extract) => extract.id === ref && extract.text.trim() === claim.claim.trim(),
            ),
          )
        )
          continue;
        const fact: EditorialFact = {
          id: claim.id,
          field: claim.field,
          value: claim.claim,
          sourceId: source.id,
          trust: classification,
          evidenceRefs: [...claim.evidenceRefs],
          confidence: claim.confidence,
          usableInCopy:
            official &&
            claim.usableInCopy &&
            !['price', 'inventory', 'media', 'availability', 'discounts'].includes(claim.field) &&
            !evidence.internalFacts.some((internal) => internal.field === claim.field),
        };
        (official ? evidence.officialBrandFacts : evidence.secondaryFacts).push(fact);
      }
    }
  evidence.unsupportedClaims = grounding.evidence.unsupportedClaims.filter(
    (claim) =>
      !evidence.officialBrandFacts.some((fact) => fact.usableInCopy && fact.field === claim.field),
  );
  return { ...grounding, evidence };
}
export function usableEditorialFacts(grounding: EditorialGrounding): EditorialFact[] {
  return [...grounding.evidence.internalFacts, ...grounding.evidence.officialBrandFacts].filter(
    (fact) => fact.usableInCopy,
  );
}

export async function readEditorialGrounding(
  selected: ProductListItemDTO,
): Promise<EditorialGrounding> {
  const product = await productsComposition.getProductById.execute(
    createGetProductByIdQuery(selected.id),
  );
  if (!product) throw new Error('EDITORIAL_PRODUCT_NOT_FOUND');
  assertProductIdentity(identifyProduct(selected), identifyProduct(product));
  const grounding = internalEditorialGrounding(product, new Date().toISOString());
  const [inventory, images, videos] = await Promise.allSettled([
    inventoryComposition.getInventory.execute(),
    productsComposition.canReadImages
      ? productsComposition.getProductImages.execute({ productId: product.id })
      : Promise.reject(new Error('IMAGES_UNAVAILABLE')),
    readEditorialVideoAssets(product.id),
  ]);
  const addOperational = (sourceId: string, label: string, values: string[]) => {
    grounding.evidence.sources.push({
      id: sourceId,
      label,
      retrievedAt: new Date().toISOString(),
      trust: 'VERIFIED_INTERNAL',
    });
    values.forEach((value, index) =>
      grounding.evidence.internalFacts.push({
        id: `${sourceId}:${index}`,
        sourceId,
        field: sourceId,
        value,
        trust: 'VERIFIED_INTERNAL',
        usableInCopy: false,
      }),
    );
  };
  const balance =
    inventory.status === 'fulfilled'
      ? inventory.value.find((entry) => entry.productId === product.id)
      : undefined;
  if (balance)
    addOperational('inventory', 'Inventario LIHEN · contexto operacional', [
      `Stock: ${balance.stockAvailable}`,
    ]);
  else
    grounding.evidence.unsupportedClaims.push({
      field: 'inventory',
      status: 'INSUFFICIENT_EVIDENCE',
    });
  if (images.status === 'fulfilled')
    addOperational(
      'images',
      'Imágenes autorizadas LIHEN · referencias, sin análisis visual',
      images.value.filter((image) => image.productId === product.id).map((image) => image.id),
    );
  else
    grounding.evidence.unsupportedClaims.push({ field: 'images', status: 'INSUFFICIENT_EVIDENCE' });
  if (videos.status === 'fulfilled')
    addOperational(
      'videos',
      'Videos autorizados LIHEN · referencias, sin análisis audiovisual',
      videos.value.filter((video) => video.productId === product.id).map((video) => video.id),
    );
  else
    grounding.evidence.unsupportedClaims.push({ field: 'videos', status: 'INSUFFICIENT_EVIDENCE' });
  return grounding;
}
