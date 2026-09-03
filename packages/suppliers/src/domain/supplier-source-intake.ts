export type SupplierSourceType = 'PDF' | 'XLSX' | 'CSV' | 'IMAGE' | 'OTHER';

export type SupplierSourceBusinessLine = 'BEAUTY_CARE' | 'STYLE';

export type SupplierSourceDocumentStatus =
  | 'RECEIVED'
  | 'EXTRACTING'
  | 'EXTRACTED'
  | 'REVIEW_REQUIRED'
  | 'READY_FOR_CANDIDATES'
  | 'REJECTED'
  | 'FAILED';

export type SupplierSourceExtractionStatus =
  | 'EXTRACTED'
  | 'REVIEW_REQUIRED'
  | 'REJECTED';

export interface SupplierSourceDocument {
  readonly id: string;
  readonly supplierId: string | null;
  readonly sourceName: string;
  readonly sourceType: SupplierSourceType;
  readonly sourceSha256: string;
  readonly sourceSizeBytes: number | null;
  readonly sourceReference: string | null;
  readonly sourceDate: string | null;
  readonly businessLine: SupplierSourceBusinessLine | null;
  readonly status: SupplierSourceDocumentStatus;
  readonly extractionStrategyVersion: string | null;
}

export interface CreateSupplierSourceDocumentInput {
  readonly id: string;
  readonly supplierId?: string | null;
  readonly sourceName: string;
  readonly sourceType: SupplierSourceType;
  readonly sourceSha256: string;
  readonly sourceSizeBytes?: number | null;
  readonly sourceReference?: string | null;
  readonly sourceDate?: string | null;
  readonly businessLine?: SupplierSourceBusinessLine | null;
  readonly status?: SupplierSourceDocumentStatus;
  readonly extractionStrategyVersion?: string | null;
}

export interface SupplierSourceRecord {
  readonly id: string;
  readonly documentId: string;
  readonly sourceRowKey: string;
  readonly sourcePage: number | null;
  readonly sourceSlot: string | null;
  readonly rawText: string | null;
  readonly supplierReference: string | null;
  readonly productName: string | null;
  readonly brandText: string | null;
  readonly categoryText: string | null;
  readonly subcategoryText: string | null;
  readonly businessLine: SupplierSourceBusinessLine | null;
  readonly unitCost: number | null;
  readonly suggestedSalePrice: number | null;
  readonly quantityHint: number | null;
  readonly imageReference: string | null;
  readonly extractionConfidence: number | null;
  readonly extractionStatus: SupplierSourceExtractionStatus;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface CreateSupplierSourceRecordInput {
  readonly id: string;
  readonly documentId: string;
  readonly sourceRowKey: string;
  readonly sourcePage?: number | null;
  readonly sourceSlot?: string | null;
  readonly rawText?: string | null;
  readonly supplierReference?: string | null;
  readonly productName?: string | null;
  readonly brandText?: string | null;
  readonly categoryText?: string | null;
  readonly subcategoryText?: string | null;
  readonly businessLine?: SupplierSourceBusinessLine | null;
  readonly unitCost?: number | null;
  readonly suggestedSalePrice?: number | null;
  readonly quantityHint?: number | null;
  readonly imageReference?: string | null;
  readonly extractionConfidence?: number | null;
  readonly extractionStatus?: SupplierSourceExtractionStatus;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

export interface SupplierSourceIntakeSnapshot {
  readonly document: SupplierSourceDocument;
  readonly records: readonly SupplierSourceRecord[];
}

function requiredText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function nullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function nullableNonNegativeNumber(
  value: number | null | undefined,
  code: string,
): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
  return value;
}

function normalizeSha256(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error('SUPPLIER_SOURCE_SHA256_INVALID');
  }
  return normalized;
}

function normalizeSourceDate(value: string | null | undefined): string | null {
  const normalized = nullableText(value);
  if (normalized === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('SUPPLIER_SOURCE_DATE_INVALID');
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error('SUPPLIER_SOURCE_DATE_INVALID');
  }
  return normalized;
}

export function createSupplierSourceDocument(
  input: CreateSupplierSourceDocumentInput,
): SupplierSourceDocument {
  const id = requiredText(input.id, 'SUPPLIER_SOURCE_DOCUMENT_ID_REQUIRED');
  const sourceName = requiredText(
    input.sourceName,
    'SUPPLIER_SOURCE_NAME_REQUIRED',
  );
  const sourceSizeBytes = nullableNonNegativeNumber(
    input.sourceSizeBytes,
    'SUPPLIER_SOURCE_SIZE_INVALID',
  );

  if (
    sourceSizeBytes !== null &&
    (!Number.isSafeInteger(sourceSizeBytes) || sourceSizeBytes < 0)
  ) {
    throw new Error('SUPPLIER_SOURCE_SIZE_INVALID');
  }

  return {
    id,
    supplierId: nullableText(input.supplierId),
    sourceName,
    sourceType: input.sourceType,
    sourceSha256: normalizeSha256(input.sourceSha256),
    sourceSizeBytes,
    sourceReference: nullableText(input.sourceReference),
    sourceDate: normalizeSourceDate(input.sourceDate),
    businessLine: input.businessLine ?? null,
    status: input.status ?? 'RECEIVED',
    extractionStrategyVersion: nullableText(input.extractionStrategyVersion),
  };
}

export function createSupplierSourceRecord(
  input: CreateSupplierSourceRecordInput,
): SupplierSourceRecord {
  const id = requiredText(input.id, 'SUPPLIER_SOURCE_RECORD_ID_REQUIRED');
  const documentId = requiredText(
    input.documentId,
    'SUPPLIER_SOURCE_DOCUMENT_ID_REQUIRED',
  );
  const sourceRowKey = requiredText(
    input.sourceRowKey,
    'SUPPLIER_SOURCE_ROW_KEY_REQUIRED',
  );
  const sourcePage = input.sourcePage ?? null;

  if (
    sourcePage !== null &&
    (!Number.isInteger(sourcePage) || !Number.isSafeInteger(sourcePage))
  ) {
    throw new Error('SUPPLIER_SOURCE_PAGE_INVALID');
  }

  const quantityHint = nullableNonNegativeNumber(
    input.quantityHint,
    'SUPPLIER_SOURCE_QUANTITY_INVALID',
  );
  if (quantityHint !== null && !Number.isInteger(quantityHint)) {
    throw new Error('SUPPLIER_SOURCE_QUANTITY_INVALID');
  }

  const extractionConfidence = input.extractionConfidence ?? null;
  if (
    extractionConfidence !== null &&
    (!Number.isFinite(extractionConfidence) ||
      extractionConfidence < 0 ||
      extractionConfidence > 1)
  ) {
    throw new Error('SUPPLIER_SOURCE_CONFIDENCE_INVALID');
  }

  const extractionStatus = input.extractionStatus ?? 'REVIEW_REQUIRED';
  const productName = nullableText(input.productName);

  if (extractionStatus === 'EXTRACTED' && productName === null) {
    throw new Error('SUPPLIER_SOURCE_EXTRACTED_PRODUCT_NAME_REQUIRED');
  }

  return {
    id,
    documentId,
    sourceRowKey,
    sourcePage,
    sourceSlot: nullableText(input.sourceSlot),
    rawText: nullableText(input.rawText),
    supplierReference: nullableText(input.supplierReference),
    productName,
    brandText: nullableText(input.brandText),
    categoryText: nullableText(input.categoryText),
    subcategoryText: nullableText(input.subcategoryText),
    businessLine: input.businessLine ?? null,
    unitCost: nullableNonNegativeNumber(
      input.unitCost,
      'SUPPLIER_SOURCE_UNIT_COST_INVALID',
    ),
    suggestedSalePrice: nullableNonNegativeNumber(
      input.suggestedSalePrice,
      'SUPPLIER_SOURCE_SUGGESTED_SALE_PRICE_INVALID',
    ),
    quantityHint,
    imageReference: nullableText(input.imageReference),
    extractionConfidence,
    extractionStatus,
    evidence: Object.freeze({ ...(input.evidence ?? {}) }),
  };
}

function compareSupplierSourceRecords(
  left: SupplierSourceRecord,
  right: SupplierSourceRecord,
): number {
  const leftPage = left.sourcePage ?? Number.MAX_SAFE_INTEGER;
  const rightPage = right.sourcePage ?? Number.MAX_SAFE_INTEGER;
  if (leftPage !== rightPage) return leftPage - rightPage;

  const rowKeyComparison = left.sourceRowKey.localeCompare(right.sourceRowKey);
  if (rowKeyComparison !== 0) return rowKeyComparison;

  return left.id.localeCompare(right.id);
}

export function createSupplierSourceIntakeSnapshot(
  document: SupplierSourceDocument,
  records: readonly SupplierSourceRecord[],
): SupplierSourceIntakeSnapshot {
  const recordIds = new Set<string>();
  const rowKeys = new Set<string>();

  for (const record of records) {
    if (record.documentId !== document.id) {
      throw new Error('SUPPLIER_SOURCE_RECORD_DOCUMENT_MISMATCH');
    }
    if (recordIds.has(record.id)) {
      throw new Error('SUPPLIER_SOURCE_RECORD_ID_DUPLICATE');
    }
    if (rowKeys.has(record.sourceRowKey)) {
      throw new Error('SUPPLIER_SOURCE_ROW_KEY_DUPLICATE');
    }
    recordIds.add(record.id);
    rowKeys.add(record.sourceRowKey);
  }

  return {
    document,
    records: [...records].sort(compareSupplierSourceRecords),
  };
}
