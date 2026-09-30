import { createClient } from 'supabase';
import {
  fetchResolvedProductImageBytes,
  resolveAuthorizedProductImageAsset,
} from './product-image-asset-resolver.ts';
import { createRemoveBgTransformationProvider } from './providers/remove-bg-image-transformation.ts';
import { persistTransformedCandidate } from './persist-transformed-candidate.ts';
import { createApprovedCandidateReviewAccess } from './approved-candidate-review-access.ts';
import { promoteApprovedCandidateToCatalogPdf } from './promote-catalog-pdf-candidate.ts';
import { readAssistantProductContext } from './assistant-product-context-reader.ts';
import { createGroqModelPort } from './providers/groq-model.ts';
import { parseEditorialAuthorityRegistry } from './providers/editorial-authority-registry.ts';
import { createEditorialResearchRuntimeDependencies } from './providers/editorial-research-search.ts';
import type { EditorialResearchSearchConfig } from './providers/editorial-research-search.ts';
import { evaluateEditorialResearchReadiness } from './providers/editorial-research-readiness.ts';
import {
  createDocumentExtractionRuntime,
  createSupabaseStorageDocumentContentResolver,
  createSupplierDocumentSourceResolver,
  createSequentialSupabaseStorageDocumentExecution,
} from './document-extraction-edge.mjs';
import {
  INTELLIGENCE_PERMISSION,
  createCreativeIntelligenceHandler,
  createImageTransformationHandler,
  orchestrateIntelligenceRequest,
  researchEditorialProduct,
  runLihenAssistantTurn,
} from './intelligence-core-edge.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function publishableKey(): string {
  const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');

  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }

  const legacy = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacy) return legacy;

  throw new Error('SUPABASE_PUBLISHABLE_KEY_NOT_CONFIGURED');
}

function editorialResearchDomains(): readonly string[] {
  return [
    ...new Set(
      (Deno.env.get('LIHEN_EDITORIAL_RESEARCH_ALLOWED_DOMAINS') ?? '')
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function editorialResearchConfig(): EditorialResearchSearchConfig {
  return {
    enabled: Deno.env.get('LIHEN_EDITORIAL_RESEARCH_ENABLED')?.trim() === 'true',
    groqApiKey: Deno.env.get('GROQ_API_KEY')?.trim(),
    allowedDomains: editorialResearchDomains(),
    authorities: parseEditorialAuthorityRegistry(
      Deno.env.get('LIHEN_EDITORIAL_RESEARCH_AUTHORITIES'),
    ),
    freeOnlyEvidenceRef: Deno.env.get('LIHEN_EDITORIAL_RESEARCH_FREE_ONLY_EVIDENCE_REF')?.trim(),
    freeOnlyVerifiedAt: Deno.env.get('LIHEN_EDITORIAL_RESEARCH_FREE_ONLY_VERIFIED_AT')?.trim(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return json({ error: 'LIHEN_AUTH_REQUIRED' }, 401);
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', publishableKey(), {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!serviceRoleKey) {
      return json({ error: 'LIHEN_SERVICE_ROLE_NOT_CONFIGURED' }, 500);
    }

    const serviceSupabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const token = authorization.slice('Bearer '.length);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'LIHEN_AUTH_INVALID' }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,role_code,authorization_status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('INTELLIGENCE_PROFILE_LOOKUP_FAILED', profileError);
      return json({ error: 'LIHEN_AUTHORIZATION_LOOKUP_FAILED' }, 500);
    }

    if (!profile || profile.authorization_status !== 'ACTIVE') {
      return json({ error: 'LIHEN_INTELLIGENCE_FORBIDDEN' }, 403);
    }

    if (!['OWNER', 'ADMIN'].includes(profile.role_code)) {
      return json({ error: 'LIHEN_INTELLIGENCE_ROLE_FORBIDDEN' }, 403);
    }

    const payload = await req.json().catch(() => null);

    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return json({ error: 'LIHEN_INTELLIGENCE_REQUEST_INVALID' }, 400);
    }

    const body = payload as Record<string, unknown>;

    const action = typeof body.action === 'string' ? body.action.trim() : '';

    if (action === 'EDITORIAL_RESEARCH_PREFLIGHT') {
      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        readiness: evaluateEditorialResearchReadiness(editorialResearchConfig()),
      });
    }

    if (action === 'EDITORIAL_RESEARCH') {
      const productId =
        typeof body.productId === 'string' && body.productId.trim() ? body.productId.trim() : '';

      if (!productId) {
        return json({ error: 'LIHEN_EDITORIAL_RESEARCH_PRODUCT_ID_REQUIRED' }, 400);
      }

      const product = await readAssistantProductContext(supabase, productId);

      if (!product) {
        return json({ error: 'PRODUCT_NOT_FOUND' }, 404);
      }

      const identity = {
        productId: product.id,
        productName: product.name,
        ...(product.sku ? { sku: product.sku } : {}),
        ...(product.brandId ? { brandId: product.brandId } : {}),
        ...(product.brandName ? { brand: product.brandName } : {}),
        ...(product.categoryName ? { category: product.categoryName } : {}),
      };

      const requestId = crypto.randomUUID();
      const correlationId = crypto.randomUUID();

      const report = await researchEditorialProduct(
        identity,
        {
          correlationId,
          requestedBy: user.id,
          context: {
            contextId: `product:${product.id}`,
            type: 'PRODUCT',
            entityId: product.id,
            attributes: {},
          },
        },
        createEditorialResearchRuntimeDependencies(editorialResearchConfig()),
      );

      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        requestId,
        correlationId,
        report,
      });
    }

    if (action === 'DOCUMENT_EXTRACTION') {
      const documentId =
        typeof body.documentId === 'string'
        && body.documentId.trim()
          ? body.documentId.trim()
          : '';

      if (!documentId) {
        return json(
          {
            error:
              'LIHEN_DOCUMENT_EXTRACTION_DOCUMENT_ID_REQUIRED',
          },
          400,
        );
      }

      const geminiApiKey =
        Deno.env.get('GEMINI_API_KEY')
          ?.trim();

      if (!geminiApiKey) {
        return json(
          {
            error:
              'LIHEN_GEMINI_API_KEY_NOT_CONFIGURED',
          },
          503,
        );
      }

      const sourceResolver =
        createSupplierDocumentSourceResolver(
          supabase,
        );

      const resolver =
        createSupabaseStorageDocumentContentResolver({
          client: supabase,
          resolveSource:
            sourceResolver,
        });

      const runtime =
        createDocumentExtractionRuntime({
          geminiApiKey,
          resolver,
          executeDocument:
            createSequentialSupabaseStorageDocumentExecution({
              client: supabase,
              resolveSource:
                sourceResolver,
              maxPartBytes:
                12 * 1024 * 1024,
            }),
          timeoutBudget: {
            primaryMs: 30000,
            localFallbackMs: 300000,
          },
        });

      const extraction =
        await runtime.execute({
          requestId:
            crypto.randomUUID(),
          document: {
            documentRef:
              documentId,
          },
        });

      return json({
        runtime:
          'LIHEN_INTELLIGENCE',
        action,
        roleCode:
          profile.role_code,
        documentId,
        providerPolicy: {
          primary:
            'GEMINI_3_6_FLASH',
          localFallback:
            'OLLAMA_QWEN3_VL_4B',
          localFallbackRuntime:
            runtime.localFallbackRuntime,
          freeOnly: true,
        },
        extraction,
      });
    }

    if (action === 'ASSISTANT') {
      const productId =
        typeof body.productId === 'string' && body.productId.trim() ? body.productId.trim() : '';

      const prompt =
        typeof body.prompt === 'string' && body.prompt.trim() ? body.prompt.trim() : '';

      if (!productId) {
        return json({ error: 'LIHEN_ASSISTANT_PRODUCT_ID_REQUIRED' }, 400);
      }

      if (!prompt) {
        return json({ error: 'LIHEN_ASSISTANT_PROMPT_REQUIRED' }, 400);
      }

      const requestId = crypto.randomUUID();
      const correlationId = crypto.randomUUID();

      const assistantPrincipal = {
        actorId: 'lihen-assistant-intelligence',
        actorType: 'INTELLIGENCE' as const,
        grants: [
          {
            permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
            effect: 'ALLOW' as const,
            source: 'intelligence-runtime-assistant-policy',
          },
          {
            permission: INTELLIGENCE_PERMISSION.ANALYZE,
            effect: 'ALLOW' as const,
            source: 'intelligence-runtime-assistant-policy',
          },
        ],
      };

      const assistant = await runLihenAssistantTurn(
        {
          context: {
            sources: [
              {
                type: 'PRODUCT' as const,
                async resolve({ query }) {
                  const requestedProductId = query.entityId?.trim();

                  if (!requestedProductId) {
                    throw new Error('LIHEN_ASSISTANT_PRODUCT_ID_REQUIRED');
                  }

                  const product = await readAssistantProductContext(supabase, requestedProductId);

                  if (!product) {
                    throw new Error('PRODUCT_NOT_FOUND');
                  }

                  return {
                    source: 'ProductMaster:GetProductById',
                    attributes: {
                      product,
                    },
                  };
                },
              },
            ],
          },
          ...(Deno.env.get('GROQ_API_KEY')?.trim()
            ? {
                model: createGroqModelPort({
                  apiKey: Deno.env.get('GROQ_API_KEY')!.trim(),
                }),
              }
            : {}),
        },
        {
          requestId,
          correlationId,
          requestedBy: user.id,
          principal: assistantPrincipal,
          prompt,
          contextQuery: {
            contextId: `assistant-product:${productId}`,
            type: 'PRODUCT',
            entityId: productId,
          },
        },
      );

      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        roleCode: profile.role_code,
        assistant,
      });
    }

    if (action === 'LIST_STYLE_CATALOG_PDF_APPROVED_UNPROMOTED') {
      const { data: rows, error: listError } =
        await serviceSupabase.rpc(
          'list_style_catalog_pdf_approved_unpromoted',
        );

      if (listError) {
        return json(
          {
            error: 'LIHEN_STYLE_APPROVED_UNPROMOTED_READ_FAILED',
            message: listError.message,
          },
          500,
        );
      }

      if (!Array.isArray(rows)) {
        return json(
          { error: 'LIHEN_STYLE_APPROVED_UNPROMOTED_INVALID_RESULT' },
          500,
        );
      }

      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        roleCode: profile.role_code,
        count: rows.length,
        items: rows.map((raw) => {
          const row = raw as {
            candidate_id: string;
            product_id: string;
            sku: string | null;
            product_name: string;
          };

          return {
            candidateId: row.candidate_id,
            productId: row.product_id,
            sku: row.sku,
            productName: row.product_name,
          };
        }),
      });
    }

    if (action === 'PREPARE_STYLE_CATALOG_PDF_BROWSER_PROMOTION') {
      const candidateId =
        typeof body.candidateId === 'string'
        && body.candidateId.trim()
          ? body.candidateId.trim()
          : '';

      const sha256 =
        typeof body.sha256 === 'string'
          ? body.sha256.trim().toLowerCase()
          : '';

      const byteSize =
        typeof body.byteSize === 'number'
          ? body.byteSize
          : 0;

      const width =
        typeof body.width === 'number'
          ? body.width
          : 0;

      const height =
        typeof body.height === 'number'
          ? body.height
          : 0;

      if (
        !candidateId
        || !/^[0-9a-f]{64}$/.test(sha256)
        || byteSize <= 0
        || byteSize > 3 * 1024 * 1024
        || width <= 0
        || height <= 0
      ) {
        return json(
          { error: 'LIHEN_STYLE_BROWSER_PROMOTION_METADATA_INVALID' },
          400,
        );
      }

      const context =
        await createApprovedCandidateReviewAccess(
          serviceSupabase,
          candidateId,
        );

      const productImageId = context.candidateId;

      const storagePath = [
        'products',
        context.productId,
        productImageId,
        'web',
        `${sha256}.webp`,
      ].join('/');

      const bucket =
        serviceSupabase.storage.from('lihen-product-web');

      const { data: signedUpload, error: signedUploadError } =
        await bucket.createSignedUploadUrl(
          storagePath,
          { upsert: true },
        );

      if (
        signedUploadError
        || !signedUpload?.token
        || !signedUpload?.path
      ) {
        return json(
          {
            error: 'LIHEN_STYLE_BROWSER_PROMOTION_SIGNED_UPLOAD_FAILED',
            message:
              signedUploadError?.message ?? 'SIGNED_UPLOAD_MISSING',
          },
          500,
        );
      }

      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        roleCode: profile.role_code,
        candidateId: context.candidateId,
        productId: context.productId,
        productImageId,
        sourceId: context.sourceId,
        reviewUrl: context.signedUrl,
        reviewExpiresInSeconds: context.expiresInSeconds,
        storageBucket: 'lihen-product-web',
        storagePath,
        uploadToken: signedUpload.token,
        mimeType: 'image/webp',
        byteSize,
        sha256,
        width,
        height,
      });
    }

    if (action === 'FINALIZE_STYLE_CATALOG_PDF_BROWSER_PROMOTION') {
      const candidateId =
        typeof body.candidateId === 'string'
        && body.candidateId.trim()
          ? body.candidateId.trim()
          : '';

      const sha256 =
        typeof body.sha256 === 'string'
          ? body.sha256.trim().toLowerCase()
          : '';

      const byteSize =
        typeof body.byteSize === 'number'
          ? body.byteSize
          : 0;

      const width =
        typeof body.width === 'number'
          ? body.width
          : 0;

      const height =
        typeof body.height === 'number'
          ? body.height
          : 0;

      if (
        !candidateId
        || !/^[0-9a-f]{64}$/.test(sha256)
        || byteSize <= 0
        || byteSize > 3 * 1024 * 1024
        || width <= 0
        || height <= 0
      ) {
        return json(
          { error: 'LIHEN_STYLE_BROWSER_PROMOTION_METADATA_INVALID' },
          400,
        );
      }

      const context =
        await createApprovedCandidateReviewAccess(
          serviceSupabase,
          candidateId,
        );

      const productImageId = context.candidateId;

      const storagePath = [
        'products',
        context.productId,
        productImageId,
        'web',
        `${sha256}.webp`,
      ].join('/');

      const bucket =
        serviceSupabase.storage.from('lihen-product-web');

      const { data: publicData } =
        bucket.getPublicUrl(storagePath);

      if (!publicData.publicUrl) {
        return json(
          { error: 'LIHEN_STYLE_BROWSER_PROMOTION_PUBLIC_URL_MISSING' },
          500,
        );
      }

      const operationKey =
        `catalog-pdf-promotion:${context.candidateId}:${sha256}`;

      const { data: promoted, error: promotionError } =
        await serviceSupabase.rpc(
          'promote_catalog_pdf_approved_candidate',
          {
            p_operation_key: operationKey,
            p_candidate_id: context.candidateId,
            p_product_image_id: productImageId,
            p_bucket_id: 'lihen-product-web',
            p_object_path: storagePath,
            p_public_url: publicData.publicUrl,
            p_mime_type: 'image/webp',
            p_byte_size: byteSize,
            p_sha256: sha256,
            p_width_px: width,
            p_height_px: height,
          },
        );

      if (promotionError) {
        return json(
          {
            error: 'LIHEN_STYLE_BROWSER_PROMOTION_FINALIZE_FAILED',
            message: promotionError.message,
          },
          500,
        );
      }

      if (!Array.isArray(promoted) || promoted.length !== 1) {
        return json(
          { error: 'LIHEN_STYLE_BROWSER_PROMOTION_FINALIZE_INVALID_RESULT' },
          500,
        );
      }

      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        roleCode: profile.role_code,
        promotion: promoted[0],
      });
    }

    if (action === 'PROMOTE_STYLE_CATALOG_PDF_BATCH') {
      const { data: rows, error: listError } =
        await serviceSupabase.rpc(
          'list_style_catalog_pdf_approved_unpromoted',
        );

      if (listError) {
        return json(
          {
            error: 'LIHEN_STYLE_BATCH_PROMOTION_READ_FAILED',
            message: listError.message,
          },
          500,
        );
      }

      if (!Array.isArray(rows)) {
        return json(
          { error: 'LIHEN_STYLE_BATCH_PROMOTION_INVALID_RESULT' },
          500,
        );
      }

      const promoted = [];
      const failed = [];
      const batch = rows.slice(0, 1);

      for (const raw of batch) {
        const row = raw as {
          candidate_id: string;
          product_id: string;
          sku: string | null;
          product_name: string;
        };

        try {
          const promotion =
            await promoteApprovedCandidateToCatalogPdf(
              serviceSupabase,
              row.candidate_id,
            );

          promoted.push({
            sku: row.sku,
            productName: row.product_name,
            ...promotion,
          });
        } catch (error) {
          failed.push({
            candidateId: row.candidate_id,
            productId: row.product_id,
            sku: row.sku,
            productName: row.product_name,
            error:
              error instanceof Error
                ? error.message
                : 'UNKNOWN_PROMOTION_FAILURE',
          });
        }
      }

      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        roleCode: profile.role_code,
        attempted: batch.length,
        promotedCount: promoted.length,
        failedCount: failed.length,
        remainingCount: Math.max(0, rows.length - batch.length),
        promoted,
        failed,
      });
    }

    if (action === 'PROMOTE_CATALOG_PDF') {
      const candidateId =
        typeof body.candidateId === 'string' && body.candidateId.trim()
          ? body.candidateId.trim()
          : '';

      if (!candidateId) {
        return json({ error: 'LIHEN_CATALOG_PDF_CANDIDATE_ID_REQUIRED' }, 400);
      }

      const promotion = await promoteApprovedCandidateToCatalogPdf(serviceSupabase, candidateId);

      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        roleCode: profile.role_code,
        promotion,
      });
    }

    if (action === 'LIST_STYLE_CATALOG_PDF_PENDING_REVIEWS') {
      const { data: rows, error: listError } =
        await serviceSupabase.rpc(
          'list_style_catalog_pdf_pending_review_candidates_controlled',
        );

      if (listError) {
        return json(
          {
            error: 'LIHEN_STYLE_REVIEW_GALLERY_READ_FAILED',
            message: listError.message,
          },
          500,
        );
      }

      if (!Array.isArray(rows)) {
        return json(
          { error: 'LIHEN_STYLE_REVIEW_GALLERY_INVALID_RESULT' },
          500,
        );
      }

      const items = [];

      for (const raw of rows) {
        const row = raw as {
          candidate_id: string;
          product_id: string;
          sku: string | null;
          product_name: string;
          source_product_image_id: string;
          review_bucket: string;
          review_path: string;
          review_mime_type: string;
          sha256: string;
          provider_name: string;
          intended_use: string;
          created_at: string;
        };

        if (
          row.review_bucket !== 'lihen-intelligence-review'
          || row.review_mime_type !== 'image/png'
          || row.intended_use !== 'CATALOG_PDF'
        ) {
          return json(
            {
              error: 'LIHEN_STYLE_REVIEW_GALLERY_CONTRACT_INVALID',
              candidateId: row.candidate_id,
            },
            500,
          );
        }

        const { data: signed, error: signedError } =
          await serviceSupabase.storage
            .from(row.review_bucket)
            .createSignedUrl(
              row.review_path,
              900,
            );

        if (signedError || !signed?.signedUrl) {
          return json(
            {
              error: 'LIHEN_STYLE_REVIEW_GALLERY_SIGNED_URL_FAILED',
              candidateId: row.candidate_id,
              message:
                signedError?.message ?? 'SIGNED_URL_MISSING',
            },
            500,
          );
        }

        items.push({
          candidateId: row.candidate_id,
          productId: row.product_id,
          sku: row.sku,
          productName: row.product_name,
          sourceProductImageId: row.source_product_image_id,
          sha256: row.sha256,
          providerName: row.provider_name,
          createdAt: row.created_at,
          signedUrl: signed.signedUrl,
          expiresInSeconds: 900,
        });
      }

      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        roleCode: profile.role_code,
        count: items.length,
        items,
      });
    }

    if (action === 'GET_CATALOG_PDF_REVIEW_ACCESS') {
      const candidateId =
        typeof body.candidateId === 'string' && body.candidateId.trim()
          ? body.candidateId.trim()
          : '';

      if (!candidateId) {
        return json({ error: 'LIHEN_CATALOG_PDF_CANDIDATE_ID_REQUIRED' }, 400);
      }

      const reviewAccess = await createApprovedCandidateReviewAccess(serviceSupabase, candidateId);

      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        roleCode: profile.role_code,
        reviewAccess,
      });
    }

    if (action === 'REGISTER_STYLE_CATEGORY_COVERS') {
      const catalogVersionId =
        typeof body.catalogVersionId === 'string'
        && body.catalogVersionId.trim()
          ? body.catalogVersionId.trim()
          : '';

      const covers = Array.isArray(body.covers)
        ? body.covers
        : [];

      if (!catalogVersionId || covers.length === 0) {
        return json(
          { error: 'LIHEN_STYLE_CATEGORY_COVERS_REQUEST_INVALID' },
          400,
        );
      }

      const registered = [];

      for (const raw of covers) {
        if (
          raw === null
          || typeof raw !== 'object'
          || Array.isArray(raw)
        ) {
          return json(
            { error: 'LIHEN_STYLE_CATEGORY_COVER_ITEM_INVALID' },
            400,
          );
        }

        const cover = raw as Record<string, unknown>;
        const categoryKey =
          typeof cover.categoryKey === 'string'
            ? cover.categoryKey.trim()
            : '';
        const categoryLabel =
          typeof cover.categoryLabel === 'string'
            ? cover.categoryLabel.trim()
            : '';
        const storagePath =
          typeof cover.storagePath === 'string'
            ? cover.storagePath.trim()
            : '';
        const publicUrl =
          typeof cover.publicUrl === 'string'
            ? cover.publicUrl.trim()
            : '';
        const mimeType =
          typeof cover.mimeType === 'string'
            ? cover.mimeType.trim()
            : '';
        const sha256 =
          typeof cover.sha256 === 'string'
            ? cover.sha256.trim()
            : '';
        const byteSize =
          typeof cover.byteSize === 'number'
            ? cover.byteSize
            : 0;
        const width =
          typeof cover.width === 'number'
            ? cover.width
            : 0;
        const height =
          typeof cover.height === 'number'
            ? cover.height
            : 0;

        const normalizedKey = categoryKey.toUpperCase();
        const extension = mimeType === 'image/webp'
          ? 'webp'
          : mimeType === 'image/jpeg'
            ? 'jpg'
            : mimeType === 'image/png'
              ? 'png'
              : '';
        const expectedPath = [
          'style',
          'category-covers',
          catalogVersionId,
          normalizedKey.toLowerCase(),
          `${sha256}.${extension}`,
        ].join('/');

        if (
          !categoryKey
          || !categoryLabel
          || !storagePath
          || !publicUrl
          || !extension
          || !/^[0-9a-f]{64}$/.test(sha256)
          || byteSize <= 0
          || width <= 0
          || height <= 0
          || storagePath !== expectedPath
        ) {
          return json(
            { error: 'LIHEN_STYLE_CATEGORY_COVER_CONTRACT_INVALID' },
            400,
          );
        }

        const { data: rows, error: registerError } =
          await serviceSupabase.rpc(
            'register_catalog_style_category_cover_asset',
            {
              p_catalog_version_id: catalogVersionId,
              p_category_key: normalizedKey,
              p_category_label: categoryLabel,
              p_storage_bucket: 'catalog-assets',
              p_storage_path: storagePath,
              p_public_url: publicUrl,
              p_mime_type: mimeType,
              p_byte_size: byteSize,
              p_sha256: sha256,
              p_width_px: width,
              p_height_px: height,
              p_approved_by: user.id,
            },
          );

        if (registerError) {
          return json(
            {
              error: 'LIHEN_STYLE_CATEGORY_COVER_REGISTER_FAILED',
              message: registerError.message,
              categoryKey: normalizedKey,
            },
            500,
          );
        }

        if (!Array.isArray(rows) || rows.length !== 1) {
          return json(
            {
              error: 'LIHEN_STYLE_CATEGORY_COVER_REGISTER_INVALID_RESULT',
              categoryKey: normalizedKey,
            },
            500,
          );
        }

        registered.push(rows[0]);
      }

      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        roleCode: profile.role_code,
        catalogVersionId,
        registered,
      });
    }

    const productId =
      typeof body.productId === 'string' && body.productId.trim()
        ? body.productId.trim()
        : undefined;

    const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';

    const intendedUse = typeof body.intendedUse === 'string' ? body.intendedUse.trim() : '';

    const sourceAssetRefs =
      Array.isArray(body.sourceAssetRefs) &&
      body.sourceAssetRefs.every((item) => typeof item === 'string')
        ? body.sourceAssetRefs
        : [];

    const constraints =
      Array.isArray(body.constraints) && body.constraints.every((item) => typeof item === 'string')
        ? body.constraints
        : [];

    if (!instruction || !intendedUse) {
      return json({ error: 'LIHEN_CREATIVE_BRIEF_INVALID' }, 400);
    }

    const requestId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    const context = {
      contextId: productId ? `product:${productId}` : `creative:${requestId}`,
      type: productId ? ('PRODUCT' as const) : ('ASSET' as const),
      ...(productId ? { entityId: productId } : {}),
      ...(body.businessLine === 'BEAUTY_CARE' || body.businessLine === 'STYLE'
        ? { businessLine: body.businessLine }
        : {}),
      attributes: {
        creativeBrief: {
          briefId: requestId,
          instruction,
          intendedUse,
          sourceAssetRefs,
          constraints,
        },
        backgroundRemovalBrief: {
          briefId: requestId,
          sourceAssetRef: sourceAssetRefs[0] ?? '',
          intendedUse,
          constraints,
        },
      },
    };

    const permissionScope = {
      domain: context.type.toLowerCase(),
      ...(context.businessLine === undefined ? {} : { businessLine: context.businessLine }),
      entityType: context.type,
      ...(context.entityId === undefined ? {} : { entityId: context.entityId }),
    };

    const principal = {
      actorId: user.id,
      actorType: 'HUMAN' as const,
      grants: [
        {
          permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
          effect: 'ALLOW' as const,
          scope: permissionScope,
          source: `LIHEN_ROLE:${profile.role_code}`,
        },
        {
          permission: INTELLIGENCE_PERMISSION.GENERATE,
          effect: 'ALLOW' as const,
          scope: permissionScope,
          source: `LIHEN_ROLE:${profile.role_code}`,
        },
      ],
    };

    const execution = await orchestrateIntelligenceRequest(
      {
        handlers: [
          createCreativeIntelligenceHandler({}),
          createImageTransformationHandler({
            imageTransformation: {
              descriptor: {
                toolId: 'remove-bg-background-removal',
                kind: 'GENERATION',
                name: 'remove.bg Background Removal',
                version: '1',
                description: 'Restricted background-removal transformation adapter.',
                readOnly: false,
              },
              async transform(request) {
                const productId = request.context.entityId;

                if (!productId) {
                  throw new Error('LIHEN_TRANSFORMATION_PRODUCT_ID_REQUIRED');
                }

                const asset = await resolveAuthorizedProductImageAsset(supabase, {
                  productId,
                  productImageId: request.sourceAssetRef,
                });

                const source = await fetchResolvedProductImageBytes(asset);

                const provider = createRemoveBgTransformationProvider();

                const transformed = await provider.removeBackground(source);

                const digest = await crypto.subtle.digest('SHA-256', transformed.bytes);

                const sha256 = Array.from(new Uint8Array(digest))
                  .map((byte) => byte.toString(16).padStart(2, '0'))
                  .join('');

                const persisted = await persistTransformedCandidate(serviceSupabase, {
                  requestId,
                  correlationId,
                  productId,
                  productImageId: request.sourceAssetRef,
                  createdBy: user.id,
                  bytes: transformed.bytes,
                  mimeType: transformed.mimeType,
                  sha256,
                  intendedUse: request.intendedUse,
                  constraints: request.constraints,
                });

                return {
                  status: 'SUCCESS',
                  data: [
                    {
                      transformedRef: persisted.transformedRef,
                      sourceAssetRef: request.sourceAssetRef,
                      mimeType: transformed.mimeType,
                      provenance: 'TRANSFORMED',
                    },
                  ],
                  messages: ['BACKGROUND_REMOVAL_PERSISTED_FOR_REVIEW', 'NO_PUBLICATION_OCCURRED'],
                };
              },
            },
          }),
        ],
      },
      {
        requestId,
        correlationId,
        requestedBy: user.id,
        principal,
        context,
        intent: {
          intentId: 'lihen-creative-runtime-foundation',
          name: 'LIHEN Creative Intelligence',
          description: instruction,
          requestedCapabilities: ['IMAGE_TRANSFORMATION'],
          requiresVerification: false,
          expectedOutput: 'CANDIDATE',
        },
      },
    );

    return json({
      runtime: 'LIHEN_INTELLIGENCE',
      requestId,
      correlationId,
      roleCode: profile.role_code,
      execution,
    });
  } catch (error) {
    console.error('LIHEN_INTELLIGENCE_RUNTIME_FAILED', error);

    return json(
      {
        error: 'LIHEN_INTELLIGENCE_RUNTIME_FAILED',
        message: error instanceof Error ? error.message : 'Unknown runtime failure.',
      },
      500,
    );
  }
});
