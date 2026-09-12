import type {
  DocumentExtraction,
  ProviderResult,
} from '@lihen/intelligence-core';

import { recordsFromExtraction } from './records';
import type {
  BenchmarkCaseExpectations,
  BenchmarkScore,
  CriticalFailure,
  DocumentExtractionGroundTruth,
  GroundTruthRecord,
  HardGateResult,
} from './types';

const WEIGHTS = {
  recordDetection: 0.10,
  productIdentity: 0.20,
  supplierReference: 0.15,
  brand: 0.05,
  classification: 0.10,
  pricing: 0.10,
  quantity: 0.05,
  pageAttribution: 0.10,
  imageAssociation: 0.10,
  falseMergeControl: 0.05,
} as const;

function norm(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function textMatch(expected: string | null | undefined, actual: string | null | undefined): number {
  if (expected === undefined) return 1;
  return norm(expected) === norm(actual) ? 1 : 0;
}

function numberMatch(expected: number | null | undefined, actual: number | null | undefined): number {
  if (expected === undefined) return 1;
  return expected === actual ? 1 : 0;
}

function pageMatch(expected: number | null, actual: number | null): number {
  return expected === actual ? 1 : 0;
}

function recordFor(ground: GroundTruthRecord, actual: ReturnType<typeof recordsFromExtraction>) {
  return actual.find((record) => record.sourceRowKey === ground.sourceRowKey);
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 1 : values.reduce((a, b) => a + b, 0) / values.length;
}

function expectedIdentityTokens(record: GroundTruthRecord): readonly string[] {
  return [record.expected.productName, record.expected.supplierReference]
    .filter((value): value is string => typeof value === 'string' && norm(value).length > 0)
    .map(norm);
}

function hasFalseMerge(
  groundTruth: DocumentExtractionGroundTruth,
  actual: ReturnType<typeof recordsFromExtraction>,
): boolean {
  if (groundTruth.records.length < 2 || actual.length === 0) return false;
  return actual.some((item) => {
    const haystack = norm([item.productName, item.supplierReference].filter(Boolean).join(' '));
    if (!haystack) return false;
    let matchedExpectedRecords = 0;
    for (const ground of groundTruth.records) {
      const tokens = expectedIdentityTokens(ground);
      if (tokens.length > 0 && tokens.some((token) => haystack.includes(token))) matchedExpectedRecords += 1;
      if (matchedExpectedRecords >= 2) return true;
    }
    return false;
  });
}

function inventedValueCount(
  groundTruth: DocumentExtractionGroundTruth,
  actual: ReturnType<typeof recordsFromExtraction>,
): number {
  const expectedByKey = new Map(groundTruth.records.map((record) => [record.sourceRowKey, record] as const));
  let invented = 0;
  for (const record of actual) {
    const ground = expectedByKey.get(record.sourceRowKey);
    const fields = [
      'productName', 'supplierReference', 'brandText', 'categoryText', 'subcategoryText',
      'businessLine', 'unitCost', 'suggestedSalePrice', 'quantityHint', 'imageReference',
    ] as const;
    if (!ground) {
      invented += fields.filter((field) => record[field] !== null && record[field] !== undefined).length;
      continue;
    }
    for (const field of fields) {
      const expected = ground.expected[field];
      const observed = record[field];
      if (expected === undefined) continue;
      if (expected === null && observed !== null && observed !== undefined) invented += 1;
      else if (typeof expected === 'number' && expected !== observed) invented += 1;
      else if (typeof expected === 'string' && norm(expected) !== norm(observed as string | null | undefined)) invented += 1;
    }
  }
  return invented;
}

export function scoreExtraction(
  groundTruth: DocumentExtractionGroundTruth,
  result: ProviderResult<DocumentExtraction>,
): BenchmarkScore {
  const actual = result.data ? recordsFromExtraction(result.data) : [];
  const detected = groundTruth.records.filter((record) => !!recordFor(record, actual)).length;
  const missingRecordRate = groundTruth.records.length === 0 ? 0 : (groundTruth.records.length - detected) / groundTruth.records.length;
  const recordDetection = groundTruth.records.length === 0 ? (actual.length === 0 ? 1 : 0) : detected / groundTruth.records.length;

  const productIdentity = average(groundTruth.records.map((ground) => {
    const item = recordFor(ground, actual);
    return item ? textMatch(ground.expected.productName, item.productName) : 0;
  }));
  const supplierReference = average(groundTruth.records.map((ground) => {
    const item = recordFor(ground, actual);
    return item ? textMatch(ground.expected.supplierReference, item.supplierReference) : 0;
  }));
  const brand = average(groundTruth.records.map((ground) => {
    const item = recordFor(ground, actual);
    return item ? textMatch(ground.expected.brandText, item.brandText) : 0;
  }));
  const classification = average(groundTruth.records.flatMap((ground) => {
    const item = recordFor(ground, actual);
    if (!item) return [0, 0, 0];
    return [
      textMatch(ground.expected.categoryText, item.categoryText),
      textMatch(ground.expected.subcategoryText, item.subcategoryText),
      textMatch(ground.expected.businessLine, item.businessLine),
    ];
  }));
  const pricing = average(groundTruth.records.flatMap((ground) => {
    const item = recordFor(ground, actual);
    if (!item) return [0, 0];
    return [
      numberMatch(ground.expected.unitCost, item.unitCost),
      numberMatch(ground.expected.suggestedSalePrice, item.suggestedSalePrice),
    ];
  }));
  const quantity = average(groundTruth.records.map((ground) => {
    const item = recordFor(ground, actual);
    return item ? numberMatch(ground.expected.quantityHint, item.quantityHint) : 0;
  }));
  const pageAttribution = average(groundTruth.records.map((ground) => {
    const item = recordFor(ground, actual);
    return item ? pageMatch(ground.sourcePage, item.sourcePage) : 0;
  }));
  const imageAssociation = average(groundTruth.records.map((ground) => {
    const item = recordFor(ground, actual);
    return item ? textMatch(ground.expected.imageReference, item.imageReference) : 0;
  }));
  const falseMergeControl = hasFalseMerge(groundTruth, actual) ? 0 : 1;

  const actualNonNullValues = actual.reduce((count, record) => count + [
    record.productName, record.supplierReference, record.brandText, record.categoryText,
    record.subcategoryText, record.businessLine, record.unitCost, record.suggestedSalePrice,
    record.quantityHint, record.imageReference,
  ].filter((value) => value !== null && value !== undefined).length, 0);
  const inventedNonNullValues = inventedValueCount(groundTruth, actual);
  const inventedValueRate = actualNonNullValues === 0 ? 0 : inventedNonNullValues / actualNonNullValues;

  const dimensions = {
    recordDetection, productIdentity, supplierReference, brand, classification, pricing,
    quantity, pageAttribution, imageAssociation, falseMergeControl,
  };
  const total =
    dimensions.recordDetection * WEIGHTS.recordDetection +
    dimensions.productIdentity * WEIGHTS.productIdentity +
    dimensions.supplierReference * WEIGHTS.supplierReference +
    dimensions.brand * WEIGHTS.brand +
    dimensions.classification * WEIGHTS.classification +
    dimensions.pricing * WEIGHTS.pricing +
    dimensions.quantity * WEIGHTS.quantity +
    dimensions.pageAttribution * WEIGHTS.pageAttribution +
    dimensions.imageAssociation * WEIGHTS.imageAssociation +
    dimensions.falseMergeControl * WEIGHTS.falseMergeControl;

  return { total, dimensions, inventedValueRate, missingRecordRate };
}

export function evaluateHardGates(
  groundTruth: DocumentExtractionGroundTruth,
  result: ProviderResult<DocumentExtraction>,
  expectations?: BenchmarkCaseExpectations,
): HardGateResult {
  const failures = new Set<CriticalFailure>();

  if (result.data && result.data.documentRef !== groundTruth.documentRef) failures.add('DOCUMENT_REF_MISMATCH');
  if (result.data && groundTruth.expectedPages.some((page) => !result.data!.pages.includes(page))) failures.add('SILENT_PAGE_OMISSION');
  if (expectations?.expectedStatus === 'PARTIAL' && result.status === 'SUCCESS') failures.add('PARTIAL_REPORTED_AS_SUCCESS');

  const warnings = [...result.messages, ...(result.data?.warnings ?? [])];
  for (const fragment of expectations?.requiredWarningFragments ?? []) {
    if (!warnings.some((warning) => warning.includes(fragment))) failures.add('WARNINGS_DROPPED');
  }

  const actual = result.data ? recordsFromExtraction(result.data) : [];
  for (const ground of groundTruth.records) {
    const item = recordFor(ground, actual);
    if (!item) continue;
    if (ground.expected.productName !== undefined && textMatch(ground.expected.productName, item.productName) === 0) failures.add('INVENTED_PRODUCT_IDENTITY');
    if (ground.expected.supplierReference !== undefined && textMatch(ground.expected.supplierReference, item.supplierReference) === 0) failures.add('INVENTED_SUPPLIER_REFERENCE');
    if (
      (ground.expected.unitCost !== undefined && numberMatch(ground.expected.unitCost, item.unitCost) === 0) ||
      (ground.expected.suggestedSalePrice !== undefined && numberMatch(ground.expected.suggestedSalePrice, item.suggestedSalePrice) === 0)
    ) failures.add('WRONG_PRICE_ASSOCIATION');
    if (ground.expected.imageReference !== undefined && textMatch(ground.expected.imageReference, item.imageReference) === 0) failures.add('WRONG_IMAGE_ASSOCIATION');
  }
  if (hasFalseMerge(groundTruth, actual)) failures.add('FALSE_PRODUCT_MERGE');
  return { passed: failures.size === 0, failures: [...failures] };
}
