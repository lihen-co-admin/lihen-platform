import { getStorefrontRuntimeConfig } from './storefront-runtime-config';

export interface StorefrontProductEnrichment {
  summary: string | null;
  benefits: string[];
  ingredients: string[];
  presentation: string[];
  usageCare: string[];
  variants: string[];
  faq: Array<{ question: string; answer: string }>;
  evidenceCount: number;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function faqItems(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.question !== 'string' || typeof row.answer !== 'string') return [];
    return [{ question: row.question, answer: row.answer }];
  });
}

export async function getStorefrontProductEnrichment(productId: string): Promise<StorefrontProductEnrichment> {
  const config = getStorefrontRuntimeConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/get_storefront_product_enrichment_controlled`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${config.publishableKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_product_id: productId }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { summary: null, benefits: [], ingredients: [], presentation: [], usageCare: [], variants: [], faq: [], evidenceCount: 0 };
    }
    throw new Error(`No fue posible cargar el enriquecimiento del producto (${response.status}).`);
  }

  const payload: unknown = await response.json();
  const row = Array.isArray(payload) ? payload[0] : null;
  if (!row || typeof row !== 'object') {
    return { summary: null, benefits: [], ingredients: [], presentation: [], usageCare: [], variants: [], faq: [], evidenceCount: 0 };
  }

  const value = row as Record<string, unknown>;
  return {
    summary: typeof value.summary === 'string' && value.summary.trim() ? value.summary : null,
    benefits: strings(value.benefits),
    ingredients: strings(value.ingredients),
    presentation: strings(value.presentation),
    usageCare: strings(value.usage_care),
    variants: strings(value.variants),
    faq: faqItems(value.faq),
    evidenceCount: Number.isFinite(Number(value.evidence_count)) ? Number(value.evidence_count) : 0,
  };
}
