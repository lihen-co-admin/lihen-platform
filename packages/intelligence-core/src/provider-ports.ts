import type {
  CorrelationId,
  IntelligenceContext,
  ToolDescriptor,
} from './contracts';

/**
 * LIHEN Intelligence Provider & Tool Abstraction — GAP-007
 *
 * Pure provider-neutral ports. These contracts describe what Intelligence needs,
 * never which vendor/SDK must provide it.
 *
 * Infrastructure adapters may implement these ports later.
 * No port authorizes business mutation or replaces the existing Control Plane.
 */

export type ProviderOperationStatus =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'NO_RESULT'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'FAILED';

export interface ProviderUsage {
  readonly inputUnits?: number;
  readonly outputUnits?: number;
  readonly costEstimate?: number;
  readonly currency?: string;
}

export interface ProviderTrace {
  readonly providerRef: string;
  readonly modelOrEngine?: string;
  readonly requestRef?: string;
  readonly durationMs?: number;
  readonly usage?: ProviderUsage;
}

export interface ProviderResult<T> {
  readonly status: ProviderOperationStatus;
  readonly data?: T;
  readonly messages: readonly string[];
  readonly trace?: ProviderTrace;
}

export interface IntelligenceToolContext {
  readonly correlationId: CorrelationId;
  readonly requestedBy: string;
  readonly context: IntelligenceContext;
}

export interface ModelMessage {
  readonly role: 'SYSTEM' | 'USER' | 'ASSISTANT' | 'TOOL';
  readonly content: string;
}

export interface ModelCompletionRequest extends IntelligenceToolContext {
  readonly messages: readonly ModelMessage[];
  readonly responseFormat?: 'TEXT' | 'JSON';
  readonly temperature?: number;
}

export interface ModelCompletion {
  readonly text: string;
  readonly structured?: Readonly<Record<string, unknown>>;
}

export interface ModelPort {
  readonly descriptor: ToolDescriptor;
  complete(request: ModelCompletionRequest): Promise<ProviderResult<ModelCompletion>>;
}

export interface VisionAssetInput {
  readonly assetRef: string;
  readonly mimeType?: string;
  readonly sourceUri?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface VisionAnalysisRequest extends IntelligenceToolContext {
  readonly assets: readonly VisionAssetInput[];
  readonly tasks: readonly string[];
}

export interface VisionObservation {
  readonly assetRef: string;
  readonly observations: readonly string[];
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface VisionPort {
  readonly descriptor: ToolDescriptor;
  analyze(
    request: VisionAnalysisRequest,
  ): Promise<ProviderResult<readonly VisionObservation[]>>;
}

export interface SearchQuery {
  readonly query: string;
  readonly domains?: readonly string[];
  readonly maxResults?: number;
}

export interface SearchRequest extends IntelligenceToolContext {
  readonly queries: readonly SearchQuery[];
}

export interface SearchResultItem {
  readonly title: string;
  readonly uri: string;
  readonly snippet?: string;
  readonly sourceName?: string;
  readonly publishedAt?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SearchPort {
  readonly descriptor: ToolDescriptor;
  search(
    request: SearchRequest,
  ): Promise<ProviderResult<readonly SearchResultItem[]>>;
}

export interface DocumentInput {
  readonly documentRef: string;
  readonly mimeType?: string;
  readonly sourceUri?: string;
  readonly fingerprint?: string;
}

export interface DocumentExtractionRequest extends IntelligenceToolContext {
  readonly document: DocumentInput;
  readonly extractionSchema: Readonly<Record<string, unknown>>;
  readonly pageRange?: {
    readonly from: number;
    readonly to: number;
  };
}

export interface DocumentExtraction {
  readonly documentRef: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly pages: readonly number[];
  readonly warnings: readonly string[];
}

export interface DocumentExtractionPort {
  readonly descriptor: ToolDescriptor;
  extract(
    request: DocumentExtractionRequest,
  ): Promise<ProviderResult<DocumentExtraction>>;
}

export interface ImageGenerationRequest extends IntelligenceToolContext {
  readonly instruction: string;
  readonly sourceAssetRefs: readonly string[];
  readonly intendedUse: string;
  readonly constraints: readonly string[];
}

export interface GeneratedImage {
  readonly generatedRef: string;
  readonly mimeType: string;
  readonly width?: number;
  readonly height?: number;
  readonly provenance: 'GENERATED';
}

export interface ImageGenerationPort {
  readonly descriptor: ToolDescriptor;
  generate(
    request: ImageGenerationRequest,
  ): Promise<ProviderResult<readonly GeneratedImage[]>>;
}

export interface EmbeddingRequest extends IntelligenceToolContext {
  readonly items: readonly {
    readonly itemRef: string;
    readonly text?: string;
    readonly assetRef?: string;
  }[];
}

export interface EmbeddingVector {
  readonly itemRef: string;
  readonly dimensions: number;
  readonly values: readonly number[];
}

export interface EmbeddingPort {
  readonly descriptor: ToolDescriptor;
  embed(
    request: EmbeddingRequest,
  ): Promise<ProviderResult<readonly EmbeddingVector[]>>;
}

export type IntelligenceProviderPort =
  | ModelPort
  | VisionPort
  | SearchPort
  | DocumentExtractionPort
  | ImageGenerationPort
  | EmbeddingPort;

export interface IntelligenceToolRegistry {
  readonly model?: ModelPort;
  readonly vision?: VisionPort;
  readonly search?: SearchPort;
  readonly document?: DocumentExtractionPort;
  readonly imageGeneration?: ImageGenerationPort;
  readonly embeddings?: EmbeddingPort;
}

/**
 * Runtime-neutral validation for tool descriptors.
 *
 * This is intentionally descriptive only. Permission, risk, assurance and provider
 * credentials are resolved elsewhere.
 */
export function validateToolDescriptor(
  descriptor: ToolDescriptor,
  expectedKind: ToolDescriptor['kind'],
): readonly string[] {
  const issues: string[] = [];

  if (!descriptor.toolId.trim()) issues.push('TOOL_ID_REQUIRED');
  if (!descriptor.name.trim()) issues.push('TOOL_NAME_REQUIRED');
  if (!descriptor.version.trim()) issues.push('TOOL_VERSION_REQUIRED');
  if (!descriptor.description.trim()) issues.push('TOOL_DESCRIPTION_REQUIRED');
  if (descriptor.kind !== expectedKind) issues.push('TOOL_KIND_MISMATCH');

  return issues;
}
