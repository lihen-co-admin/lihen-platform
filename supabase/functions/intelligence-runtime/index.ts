import { createClient } from 'supabase';
import {
  fetchResolvedProductImageBytes,
  resolveAuthorizedProductImageAsset,
} from './product-image-asset-resolver.ts';
import {
  createRemoveBgTransformationProvider,
} from './providers/remove-bg-image-transformation.ts';
import {
  persistTransformedCandidate,
} from './persist-transformed-candidate.ts';
import {
  createApprovedCandidateReviewAccess,
} from './approved-candidate-review-access.ts';
import {
  promoteApprovedCandidateToCatalogPdf,
} from './promote-catalog-pdf-candidate.ts';
import {
  readAssistantProductContext,
} from './assistant-product-context-reader.ts';
import {
  createGroqModelPort,
} from './providers/groq-model.ts';
import {
  INTELLIGENCE_PERMISSION,
  createCreativeIntelligenceHandler,
  createImageTransformationHandler,
  orchestrateIntelligenceRequest,
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      publishableKey(),
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!serviceRoleKey) {
      return json(
        { error: 'LIHEN_SERVICE_ROLE_NOT_CONFIGURED' },
        500,
      );
    }

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

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

    if (
      payload === null
      || typeof payload !== 'object'
      || Array.isArray(payload)
    ) {
      return json({ error: 'LIHEN_INTELLIGENCE_REQUEST_INVALID' }, 400);
    }

    const body = payload as Record<string, unknown>;

    const action =
      typeof body.action === 'string' ? body.action.trim() : '';

    if (action === 'ASSISTANT') {
      const productId =
        typeof body.productId === 'string'
        && body.productId.trim()
          ? body.productId.trim()
          : '';

      const prompt =
        typeof body.prompt === 'string'
        && body.prompt.trim()
          ? body.prompt.trim()
          : '';

      if (!productId) {
        return json(
          { error: 'LIHEN_ASSISTANT_PRODUCT_ID_REQUIRED' },
          400,
        );
      }

      if (!prompt) {
        return json(
          { error: 'LIHEN_ASSISTANT_PROMPT_REQUIRED' },
          400,
        );
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
                  const requestedProductId =
                    query.entityId?.trim();

                  if (!requestedProductId) {
                    throw new Error(
                      'LIHEN_ASSISTANT_PRODUCT_ID_REQUIRED',
                    );
                  }

                  const product =
                    await readAssistantProductContext(
                      supabase,
                      requestedProductId,
                    );

                  if (!product) {
                    throw new Error(
                      'PRODUCT_NOT_FOUND',
                    );
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

    if (action === 'PROMOTE_CATALOG_PDF') {
      const candidateId =
        typeof body.candidateId === 'string'
        && body.candidateId.trim()
          ? body.candidateId.trim()
          : '';

      if (!candidateId) {
        return json(
          { error: 'LIHEN_CATALOG_PDF_CANDIDATE_ID_REQUIRED' },
          400,
        );
      }

      const promotion =
        await promoteApprovedCandidateToCatalogPdf(
          serviceSupabase,
          candidateId,
        );

      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        roleCode: profile.role_code,
        promotion,
      });
    }

    if (action === 'GET_CATALOG_PDF_REVIEW_ACCESS') {
      const candidateId =
        typeof body.candidateId === 'string'
        && body.candidateId.trim()
          ? body.candidateId.trim()
          : '';

      if (!candidateId) {
        return json(
          { error: 'LIHEN_CATALOG_PDF_CANDIDATE_ID_REQUIRED' },
          400,
        );
      }

      const reviewAccess =
        await createApprovedCandidateReviewAccess(
          serviceSupabase,
          candidateId,
        );

      return json({
        runtime: 'LIHEN_INTELLIGENCE',
        action,
        roleCode: profile.role_code,
        reviewAccess,
      });
    }

    const productId =
      typeof body.productId === 'string' && body.productId.trim()
        ? body.productId.trim()
        : undefined;

    const instruction =
      typeof body.instruction === 'string' ? body.instruction.trim() : '';

    const intendedUse =
      typeof body.intendedUse === 'string' ? body.intendedUse.trim() : '';

    const sourceAssetRefs =
      Array.isArray(body.sourceAssetRefs)
      && body.sourceAssetRefs.every((item) => typeof item === 'string')
        ? body.sourceAssetRefs
        : [];

    const constraints =
      Array.isArray(body.constraints)
      && body.constraints.every((item) => typeof item === 'string')
        ? body.constraints
        : [];

    if (!instruction || !intendedUse) {
      return json({ error: 'LIHEN_CREATIVE_BRIEF_INVALID' }, 400);
    }

    const requestId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    const context = {
      contextId: productId
        ? `product:${productId}`
        : `creative:${requestId}`,
      type: productId ? 'PRODUCT' as const : 'ASSET' as const,
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
      ...(context.businessLine === undefined
        ? {}
        : { businessLine: context.businessLine }),
      entityType: context.type,
      ...(context.entityId === undefined
        ? {}
        : { entityId: context.entityId }),
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

                const asset = await resolveAuthorizedProductImageAsset(
                  supabase,
                  {
                    productId,
                    productImageId: request.sourceAssetRef,
                  },
                );

                const source = await fetchResolvedProductImageBytes(asset);

                const provider =
                  createRemoveBgTransformationProvider();

                const transformed =
                  await provider.removeBackground(source);

                const digest = await crypto.subtle.digest(
                  'SHA-256',
                  transformed.bytes,
                );

                const sha256 = Array.from(
                  new Uint8Array(digest),
                )
                  .map((byte) => byte.toString(16).padStart(2, '0'))
                  .join('');

                const persisted =
                  await persistTransformedCandidate(
                    serviceSupabase,
                    {
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
                    },
                  );

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
                  messages: [
                    'BACKGROUND_REMOVAL_PERSISTED_FOR_REVIEW',
                    'NO_PUBLICATION_OCCURRED',
                  ],
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
