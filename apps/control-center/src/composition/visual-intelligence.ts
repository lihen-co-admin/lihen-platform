import { getBrowserSupabaseClient, parseBrowserEnv } from '@lihen/database';
import {
  researchVerifiedProductImages,
  type ProductImageResearchDependencies,
  type SearchProductIdentity,
} from '@lihen/intelligence-core';
import {
  evaluateProductMediaSourceReadiness,
  type ProductDetailDTO,
  type ProductImageDTO,
} from '@lihen/products';

/** Product Master does not expose manufacturer/reference/variant today. Never infer them from SKU,
 * catalog code, category, a crop, a Lens decision or an AI confidence score. */
export function productImageSearchIdentity(product: ProductDetailDTO): SearchProductIdentity {
  return {
    productId: product.id,
    productName: product.name,
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.brandId ? { brandId: product.brandId } : {}),
    ...(product.brandName ? { brand: product.brandName } : {}),
  };
}

export function evaluateExistingProductImage(
  image: ProductImageDTO,
  dimensions?: { widthPx: number; heightPx: number },
) {
  return {
    imageId: image.id,
    identityMatch: 'INSUFFICIENT_EVIDENCE' as const,
    // Quality is separate from identity; measured dimensions cannot establish exact identity.
    quality: evaluateProductMediaSourceReadiness({
      sourceType: image.sourceType,
      isExactProductMatch: true,
      publicationEligibility: 'ELIGIBLE_PRIMARY',
      ...dimensions,
    }),
    reasons: [
      'NO_PHOTOGRAPH_IDENTITY_EVIDENCE',
      ...(!dimensions ? ['DIMENSIONS_NOT_EXPOSED'] : []),
    ],
  };
}

/** Same SearchPort and authority registry as editorial research; no browser provider/credentials.
 * Default is explicitly unconfigured: existing runtime has no photograph/rights evidence contract.
 */
export function createVerifiedImageResearch(dependencies: ProductImageResearchDependencies = {}) {
  return {
    configured: Boolean(dependencies.search && dependencies.photographEvidenceSupported),
    research: researchVerifiedProductImages,
    dependencies,
  };
}
export const verifiedImageResearch = createVerifiedImageResearch();

export interface VisualIntelligenceSessionSummary {
  readonly sessionId: string;
  readonly skuSnapshot: string | null;
  readonly productNameSnapshot: string | null;
  readonly status: string;
  readonly identityScope: string | null;
  readonly signalCount: number;
  readonly candidateCount: number;
  readonly bestCandidateConfidence: number | null;
  readonly decisionStatus: string | null;
  readonly decidedBrand: string | null;
  readonly decidedProductName: string | null;
  readonly decidedVariant: string | null;
  readonly rightsStatus: string | null;
  readonly requiresHumanReview: boolean;
  readonly nextAction: string | null;
}

interface VisualIntelligenceSummaryRow {
  session_id: string;
  sku_snapshot: string | null;
  product_name_snapshot: string | null;
  status: string;
  identity_scope: string | null;
  signal_count: number | string | null;
  candidate_count: number | string | null;
  best_candidate_confidence: number | string | null;
  decision_status: string | null;
  decided_brand: string | null;
  decided_product_name: string | null;
  decided_variant: string | null;
  rights_status: string | null;
  requires_human_review: boolean | null;
  next_action: string | null;
}

function toNumber(value: number | string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapSummary(row: VisualIntelligenceSummaryRow): VisualIntelligenceSessionSummary {
  return {
    sessionId: row.session_id,
    skuSnapshot: row.sku_snapshot,
    productNameSnapshot: row.product_name_snapshot,
    status: row.status,
    identityScope: row.identity_scope,
    signalCount: toNumber(row.signal_count),
    candidateCount: toNumber(row.candidate_count),
    bestCandidateConfidence: toOptionalNumber(row.best_candidate_confidence),
    decisionStatus: row.decision_status,
    decidedBrand: row.decided_brand,
    decidedProductName: row.decided_product_name,
    decidedVariant: row.decided_variant,
    rightsStatus: row.rights_status,
    requiresHumanReview: row.requires_human_review ?? true,
    nextAction: row.next_action,
  };
}

export interface VisualIntelligenceComposition {
  readonly enabled: boolean;
  startSession(productId: string, assetReference: string): Promise<string>;
  getSessionSummary(sessionId: string): Promise<VisualIntelligenceSessionSummary | null>;
}

export function createVisualIntelligenceComposition(
  env: Record<string, unknown> = import.meta.env,
): VisualIntelligenceComposition {
  const parsedEnv = parseBrowserEnv(env);
  const enabled = parsedEnv.VITE_VISUAL_INTELLIGENCE_MODE === 'controlled';

  return {
    enabled,
    async startSession(productId: string, assetReference: string): Promise<string> {
      if (!enabled) throw new Error('VISUAL_INTELLIGENCE_BLOCKED');
      const client = getBrowserSupabaseClient(env);
      const { data, error } = await client.rpc('start_visual_intelligence_session_controlled', {
        p_product_id: productId,
        p_input_asset_reference: assetReference,
        p_input_origin: 'CONTROL_CENTER_UPLOAD',
      });
      if (error) throw new Error(`Unable to start Lens Mode session: ${error.message}`);
      if (typeof data !== 'string' || !data) {
        throw new Error('Lens Mode intake returned no session id.');
      }
      return data;
    },
    async getSessionSummary(sessionId: string): Promise<VisualIntelligenceSessionSummary | null> {
      if (!enabled) return null;
      const client = getBrowserSupabaseClient(env);
      const { data, error } = await client.rpc('get_visual_intelligence_session_summary_controlled', {
        p_session_id: sessionId,
      });
      if (error) throw new Error(`Unable to read Lens Mode session: ${error.message}`);
      const row = Array.isArray(data) ? data[0] : data;
      return row ? mapSummary(row as VisualIntelligenceSummaryRow) : null;
    },
  };
}

export const visualIntelligenceComposition = createVisualIntelligenceComposition();
