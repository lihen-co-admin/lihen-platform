import type {
  SearchEvidenceValue,
  SearchProductEvidence,
  SearchProductIdentity,
} from '../../../../packages/intelligence-core/src/provider-ports.ts';

import type { EditorialEvidenceDocument } from './editorial-evidence-fetcher.ts';

export interface EditorialEvidenceExtractionResult {
  readonly evidence: SearchProductEvidence;
  readonly matchedIdentityFields: readonly string[];
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function documentToText(document: EditorialEvidenceDocument): string {
  if (document.contentType === 'text/plain') {
    return document.text.replace(/\s+/g, ' ').trim();
  }

  return decodeHtmlEntities(
    document.text
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForComparison(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function findExactEvidence(
  text: string,
  expected: string | undefined,
  id: string,
): {
  readonly extract?: { readonly id: string; readonly text: string };
  readonly value?: SearchEvidenceValue;
} {
  const candidate = expected?.trim();
  if (!candidate) {
    return {};
  }

  const normalizedText = normalizeForComparison(text);
  const normalizedCandidate = normalizeForComparison(candidate);

  if (!normalizedCandidate || !normalizedText.includes(normalizedCandidate)) {
    return {};
  }

  /*
   * SearchProductEvidence requires the evidence value to be backed by an
   * extract. We intentionally retain the catalog value itself only after its
   * normalized exact text is present in the retrieved document.
   *
   * No semantic inference, fuzzy matching, synonym expansion, or model output
   * is accepted here.
   */
  const extract = {
    id,
    text: candidate,
  } as const;

  return {
    extract,
    value: {
      value: candidate,
      evidenceRef: id,
    },
  };
}

export function extractEditorialProductEvidence(
  document: EditorialEvidenceDocument,
  expected: SearchProductIdentity,
): EditorialEvidenceExtractionResult {
  const text = documentToText(document);

  if (!text) {
    throw new Error('EDITORIAL_EVIDENCE_TEXT_EMPTY');
  }

  const extracts: { id: string; text: string }[] = [];
  const matchedIdentityFields: string[] = [];

  const productName = findExactEvidence(text, expected.productName, 'identity.productName');
  const sku = findExactEvidence(text, expected.sku, 'identity.sku');
  const brand = findExactEvidence(text, expected.brand, 'identity.brand');
  const category = findExactEvidence(text, expected.category, 'identity.category');

  for (const [field, result] of [
    ['productName', productName],
    ['sku', sku],
    ['brand', brand],
    ['category', category],
  ] as const) {
    if (result.extract && result.value) {
      extracts.push(result.extract);
      matchedIdentityFields.push(field);
    }
  }

  const knownAttributes: Record<string, SearchEvidenceValue> = {};

  for (const [key, value] of Object.entries(expected.knownAttributes ?? {})) {
    const result = findExactEvidence(text, value, `identity.attribute.${key}`);

    if (result.extract && result.value) {
      extracts.push(result.extract);
      knownAttributes[key] = result.value;
      matchedIdentityFields.push(`knownAttributes.${key}`);
    }
  }

  const claims: SearchProductEvidence['claims'][number][] = [];

  const presentation = knownAttributes.presentation;

  if (presentation) {
    claims.push({
      field: 'presentation',
      value: presentation.value,
      evidenceRefs: [presentation.evidenceRef],
    });
  }

  return {
    evidence: {
      domain: document.domain,
      retrievedAt: document.retrievedAt,
      extracts,
      identity: {
        ...(productName.value ? { productName: productName.value } : {}),
        ...(sku.value ? { sku: sku.value } : {}),
        ...(brand.value ? { brand: brand.value } : {}),
        ...(category.value ? { category: category.value } : {}),
        ...(Object.keys(knownAttributes).length > 0 ? { knownAttributes } : {}),
      },
      claims,
    },
    matchedIdentityFields,
  };
}
