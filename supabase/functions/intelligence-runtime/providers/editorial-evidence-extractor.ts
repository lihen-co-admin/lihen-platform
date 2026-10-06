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

function visibleHtml(html: string): string {
  // A boundary prevents a removed element from joining a heading to unrelated copy.
  // Also discard unclosed raw-text elements, comments and JSON-LD scripts.
  return html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '<hr>')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '<hr>');
}

function renderedText(html: string): string {
  // Only HTML rendering whitespace/entities change; wording is never rewritten.
  return decodeHtmlEntities(
    html
      .replace(/<\/?(?:p|div|h[1-6]|li|ul|ol|br|hr|summary)\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function documentToText(document: EditorialEvidenceDocument): string {
  if (document.contentType === 'text/plain') {
    return document.text.replace(/\s+/g, ' ').trim();
  }

  return renderedText(visibleHtml(document.text));
}

const sectionFields: Readonly<Record<string, string>> = {
  description: 'description',
  descripcion: 'description',
  ingredients: 'ingredients',
  ingredientes: 'ingredients',
  benefits: 'benefits',
  beneficios: 'benefits',
  usage: 'usage',
  uso: 'usage',
  'modo de uso': 'usage',
  presentation: 'presentation',
  presentacion: 'presentation',
};

function sectionField(label: string): string | undefined {
  const key = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/:\s*$/, '');
  return Object.prototype.hasOwnProperty.call(sectionFields, key) ? sectionFields[key] : undefined;
}

function exactSectionClaims(
  document: EditorialEvidenceDocument,
): { field: string; value: string }[] {
  const sections: { field: string; value: string }[] = [];
  const add = (label: string, value: string) => {
    const field = sectionField(label);
    if (field && value.trim()) sections.push({ field, value: value.trim() });
  };
  if (document.contentType === 'text/plain') {
    // Explicit label: value lines only; do not infer sections from surrounding prose.
    for (const line of document.text.split(/\r?\n/)) {
      const match = /^([^:]+):\s*(.+)$/.exec(line);
      if (match) add(match[1]!, match[2]!);
    }
    return sections;
  }
  const html = visibleHtml(document.text);
  // Deliberately bounded grammar: a heading followed immediately by one paragraph
  // or list. Unknown headings, intervening elements and container boundaries stop it.
  const headed =
    /<(h[1-6]|summary)\b[^>]*>([\s\S]*?)<\/\1\s*>\s*<(p|ul|ol)\b[^>]*>([\s\S]*?)<\/\3\s*>/gi;
  const safeContent = (value: string) =>
    !/<\/?(?!strong\b|em\b|b\b|i\b|span\b|br\b|li\b|a\b)[a-z][^>]*>/i.test(value);
  for (const match of html.matchAll(headed)) {
    if (safeContent(match[2]!) && safeContent(match[4]!)) {
      add(renderedText(match[2]!), renderedText(match[4]!));
    }
  }
  // Explicit inline labels are also sections, e.g. <p>Presentación: 500 ml</p>.
  for (const match of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)) {
    if (!safeContent(match[1]!)) continue;
    const labelled = /^([^:]+):\s*(.+)$/.exec(renderedText(match[1]!));
    if (labelled) add(labelled[1]!, labelled[2]!);
  }
  return sections;
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

  // Presentation is public copy only; identity checks still use expected.knownAttributes.
  for (const [index, section] of exactSectionClaims(document).entries()) {
    const id = `claim.${section.field}.${index}`;
    extracts.push({ id, text: section.value });
    claims.push({
      field: section.field,
      value: section.value,
      evidenceRefs: [id],
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
