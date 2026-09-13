export type VisibleTextMatch =
  | 'EXACT_MATCH'
  | 'NORMALIZED_EXACT_MATCH'
  | 'PARTIAL_MATCH'
  | 'MISSING'
  | 'CONTRADICTORY';

export interface VisiblePriceEvidence {
  readonly label: string | null;
  readonly rawText: string;
}

export interface VisibleSupplierEvidence {
  readonly productText: string | null;
  readonly brandText: string | null;
  readonly prices: readonly VisiblePriceEvidence[];
  readonly warnings: readonly string[];
}

export interface NormalizedPriceEvidence
  extends VisiblePriceEvidence {
  readonly amount: number | null;
}

export interface VisibleEvidenceEvaluation {
  readonly productTextMatch: VisibleTextMatch;
  readonly normalizedPrices: readonly NormalizedPriceEvidence[];
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function compareVisibleText(
  expected: string | null,
  actual: string | null,
): VisibleTextMatch {
  if (expected === null && actual === null) {
    return 'EXACT_MATCH';
  }

  if (expected === null || actual === null) {
    return 'MISSING';
  }

  if (expected === actual) {
    return 'EXACT_MATCH';
  }

  const expectedNormalized = normalizeText(expected);
  const actualNormalized = normalizeText(actual);

  if (expectedNormalized === actualNormalized) {
    return 'NORMALIZED_EXACT_MATCH';
  }

  if (
    expectedNormalized.length > 0 &&
    actualNormalized.length > 0 &&
    (
      expectedNormalized.includes(actualNormalized) ||
      actualNormalized.includes(expectedNormalized)
    )
  ) {
    return 'PARTIAL_MATCH';
  }

  return 'CONTRADICTORY';
}

/**
 * Parses price evidence using the catalog convention observed in the
 * Colombian supplier corpus.
 *
 * The provider remains responsible only for preserving raw visible text.
 * Locale-aware numeric interpretation is deterministic and happens here.
 */
export function parseCopPrice(
  rawText: string | null | undefined,
): number | null {
  if (!rawText) {
    return null;
  }

  const match = rawText
    .toUpperCase()
    .match(/(\d[\d.,]*)/);

  if (!match) {
    return null;
  }

  const value = match[1];

  if (!value) {
    return null;
  }

  if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) {
    return Number(value.replace(/\./g, ''));
  }

  if (/^\d{1,3}(?:,\d{3})+$/.test(value)) {
    return Number(value.replace(/,/g, ''));
  }

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(value)) {
    return Number(
      value
        .replace(/\./g, '')
        .replace(',', '.'),
    );
  }

  return null;
}

export function normalizeVisiblePrices(
  prices: readonly VisiblePriceEvidence[],
): readonly NormalizedPriceEvidence[] {
  return prices.map((price) => ({
    ...price,
    amount: parseCopPrice(price.rawText),
  }));
}

export function evaluateVisibleEvidence(
  expectedProductText: string | null,
  actual: VisibleSupplierEvidence,
): VisibleEvidenceEvaluation {
  return {
    productTextMatch: compareVisibleText(
      expectedProductText,
      actual.productText,
    ),
    normalizedPrices: normalizeVisiblePrices(
      actual.prices,
    ),
  };
}

export function isPassingProductTextMatch(
  match: VisibleTextMatch,
): boolean {
  return (
    match === 'EXACT_MATCH' ||
    match === 'NORMALIZED_EXACT_MATCH'
  );
}
