import type { DocumentExtraction } from '@lihen/intelligence-core';

export interface BenchmarkExtractedRecord {
  readonly sourceRowKey: string;
  readonly sourcePage: number | null;
  readonly sourceSlot: string | null;
  readonly productName: string | null;
  readonly supplierReference: string | null;
  readonly brandText: string | null;
  readonly categoryText: string | null;
  readonly subcategoryText: string | null;
  readonly businessLine: 'BEAUTY_CARE' | 'STYLE' | null;
  readonly unitCost: number | null;
  readonly suggestedSalePrice: number | null;
  readonly quantityHint: number | null;
  readonly imageReference: string | null;
  readonly extractionConfidence: number | null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : null;
}

function businessLine(
  value: unknown,
): 'BEAUTY_CARE' | 'STYLE' | null {
  return value === 'BEAUTY_CARE' || value === 'STYLE'
    ? value
    : null;
}

export function recordsFromExtraction(
  extraction: DocumentExtraction,
): readonly BenchmarkExtractedRecord[] {
  const raw = extraction.fields.records;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        !!item &&
        typeof item === 'object' &&
        !Array.isArray(item),
    )
    .map((item) => ({
      sourceRowKey:
        typeof item.sourceRowKey === 'string'
          ? item.sourceRowKey
          : '',
      sourcePage: nullableNumber(item.sourcePage),
      sourceSlot: nullableString(item.sourceSlot),
      productName: nullableString(item.productName),
      supplierReference:
        nullableString(item.supplierReference),
      brandText: nullableString(item.brandText),
      categoryText: nullableString(item.categoryText),
      subcategoryText:
        nullableString(item.subcategoryText),
      businessLine: businessLine(item.businessLine),
      unitCost: nullableNumber(item.unitCost),
      suggestedSalePrice:
        nullableNumber(item.suggestedSalePrice),
      quantityHint: nullableNumber(item.quantityHint),
      imageReference:
        nullableString(item.imageReference),
      extractionConfidence:
        nullableNumber(item.extractionConfidence),
    }));
}
