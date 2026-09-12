import type {
  DocumentExtraction,
  DocumentExtractionPort,
  DocumentExtractionRequest,
  ProviderOperationStatus,
  ProviderResult,
} from '@lihen/intelligence-core';

export type BenchmarkCategory =
  | 'BEAUTY_CARE'
  | 'STYLE'
  | 'MIXED'
  | 'EDGE';

export type BenchmarkScenario =
  | 'DIGITAL_SIMPLE'
  | 'VISUAL_CATALOG'
  | 'MULTI_PRODUCT_PAGE'
  | 'TABLE_PRICING'
  | 'SCANNED'
  | 'MULTI_VARIANT'
  | 'LOW_QUALITY'
  | 'MULTIPART'
  | 'SIZE_LIMIT';

export type BenchmarkFieldName =
  | 'productName'
  | 'supplierReference'
  | 'brandText'
  | 'categoryText'
  | 'subcategoryText'
  | 'businessLine'
  | 'unitCost'
  | 'suggestedSalePrice'
  | 'quantityHint'
  | 'imageReference'
  | 'sourcePage'
  | 'sourceSlot';

export interface BenchmarkCandidate {
  readonly candidateId: string;
  readonly displayName: string;
  readonly port: DocumentExtractionPort;
}

export interface GroundTruthRecord {
  readonly recordId: string;
  readonly sourceRowKey: string;
  readonly sourcePage: number | null;
  readonly sourceSlot?: string | null;
  readonly expected: Readonly<{
    productName?: string | null;
    supplierReference?: string | null;
    brandText?: string | null;
    categoryText?: string | null;
    subcategoryText?: string | null;
    businessLine?: 'BEAUTY_CARE' | 'STYLE' | null;
    unitCost?: number | null;
    suggestedSalePrice?: number | null;
    quantityHint?: number | null;
    imageReference?: string | null;
  }>;
}

export interface DocumentExtractionGroundTruth {
  readonly documentRef: string;
  readonly expectedPages: readonly number[];
  readonly records: readonly GroundTruthRecord[];
}

export interface MultipartExpectation {
  readonly expectedPages: readonly number[];
  readonly allowOverlappingRanges?: boolean;
}

export interface BenchmarkCaseExpectations {
  readonly expectedStatus?: ProviderOperationStatus;
  readonly allowWarnings: boolean;
  readonly allowPartial: boolean;
  readonly requireTrace: boolean;
  readonly criticalFields: readonly BenchmarkFieldName[];
  readonly requiredWarningFragments?: readonly string[];
  readonly multipart?: MultipartExpectation;
}

export interface DocumentExtractionBenchmarkCase {
  readonly caseId: string;
  readonly category: BenchmarkCategory;
  readonly scenario: BenchmarkScenario;
  readonly request: DocumentExtractionRequest;
  readonly groundTruth: DocumentExtractionGroundTruth;
  readonly expectations: BenchmarkCaseExpectations;
}

export interface BenchmarkScore {
  readonly total: number;
  readonly dimensions: Readonly<{
    recordDetection: number;
    productIdentity: number;
    supplierReference: number;
    brand: number;
    classification: number;
    pricing: number;
    quantity: number;
    pageAttribution: number;
    imageAssociation: number;
    falseMergeControl: number;
  }>;
  readonly inventedValueRate: number;
  readonly missingRecordRate: number;
}

export type CriticalFailure =
  | 'DOCUMENT_REF_MISMATCH'
  | 'SILENT_PAGE_OMISSION'
  | 'INVENTED_PRODUCT_IDENTITY'
  | 'INVENTED_SUPPLIER_REFERENCE'
  | 'WRONG_PRICE_ASSOCIATION'
  | 'WRONG_IMAGE_ASSOCIATION'
  | 'FALSE_PRODUCT_MERGE'
  | 'PARTIAL_REPORTED_AS_SUCCESS'
  | 'WARNINGS_DROPPED'
  | 'MULTIPART_DUPLICATION'
  | 'MULTIPART_PAGE_DRIFT'
  | 'CORE_MODIFICATION_REQUIRED';

export interface HardGateResult {
  readonly passed: boolean;
  readonly failures: readonly CriticalFailure[];
}

export interface BenchmarkRun {
  readonly runId: string;
  readonly candidateId: string;
  readonly caseId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly result: ProviderResult<DocumentExtraction>;
  readonly validationIssues: readonly string[];
  readonly expectationIssues: readonly string[];
  readonly score: BenchmarkScore;
  readonly hardGate: HardGateResult;
  readonly passed: boolean;
}

export interface MultipartBenchmarkResult {
  readonly parts: readonly BenchmarkRun[];
  readonly normalizedPages: readonly number[];
  readonly duplicatedPages: readonly number[];
  readonly missingPages: readonly number[];
  readonly duplicatedSourceRowKeys: readonly string[];
  readonly mergedRecordCount: number;
  readonly failures: readonly CriticalFailure[];
  readonly passed: boolean;
}

export interface BenchmarkCandidateReport {
  readonly candidateId: string;
  readonly runs: readonly BenchmarkRun[];
  readonly summary: Readonly<{
    averageScore: number;
    beautyCareScore: number;
    styleScore: number;
    edgeScore: number;
    criticalFailureCount: number;
    partialCount: number;
    failedCount: number;
    averageDurationMs?: number;
    estimatedCost?: number;
    multipartPassed: boolean;
  }>;
}
