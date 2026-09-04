import type {
  BusinessLine,
  IntelligenceContext,
  IntelligenceContextType,
} from './contracts';
import {
  evaluatePermission,
  INTELLIGENCE_PERMISSION,
} from './permission-model';
import type {
  PermissionDecision,
  PermissionPrincipal,
  PermissionRequest,
  PermissionScope,
} from './permission-model';

/**
 * LIHEN Assistant Context Resolver — WAVE 10 / GAP-033
 *
 * Resolves governed read projections for the Assistant/Intelligence layer.
 *
 * It intentionally does NOT:
 * - query SQL/Supabase directly;
 * - know React, HTTP, provider SDKs, LLMs or embeddings;
 * - duplicate domain masters;
 * - mutate canonical data;
 * - bypass RLS or the Intelligence permission model.
 *
 * Concrete read adapters are injected by composition at the application boundary.
 */
export const ASSISTANT_CONTEXT_TYPES = [
  'PRODUCT',
  'BRAND',
  'SUPPLIER',
  'CATALOG',
  'INVENTORY',
  'PRICING',
  'PURCHASE',
  'SALE',
  'FINANCE',
  'AUDIT',
] as const satisfies readonly IntelligenceContextType[];

export type AssistantContextType = (typeof ASSISTANT_CONTEXT_TYPES)[number];

export interface AssistantContextQuery {
  readonly contextId: string;
  readonly type: AssistantContextType;
  readonly entityId?: string;
  readonly businessLine?: BusinessLine;
}

export interface AssistantContextSourceRequest {
  readonly requestedBy: string;
  readonly query: AssistantContextQuery;
}

export interface AssistantContextProjection {
  /**
   * Human-readable technical source identifier, e.g. "ProductRepository" or
   * "financial_account_balances". It is traceability metadata, not authority by itself.
   */
  readonly source: string;
  /**
   * Read-only attributes projected from the domain authority.
   * The projection must not become a second master.
   */
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface AssistantContextSource {
  readonly type: AssistantContextType;
  resolve(
    request: AssistantContextSourceRequest,
  ): Promise<AssistantContextProjection>;
}

export interface AssistantContextResolverDependencies {
  readonly sources: readonly AssistantContextSource[];
}

export interface AssistantContextResolverRequest {
  readonly requestedBy: string;
  readonly principal: PermissionPrincipal;
  readonly query: AssistantContextQuery;
}

export type AssistantContextResolutionStatus =
  | 'SUCCESS'
  | 'PERMISSION_DENIED'
  | 'DEPENDENCY_FAILED';

export interface AssistantContextResolution {
  readonly status: AssistantContextResolutionStatus;
  readonly query: AssistantContextQuery;
  readonly permissionDecision: PermissionDecision;
  readonly context?: IntelligenceContext;
  readonly source?: string;
  readonly messages: readonly string[];
}

export type AssistantContextBundleStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'NO_CONTEXT'
  | 'PERMISSION_DENIED'
  | 'DEPENDENCY_FAILED';

export interface AssistantContextBundleRequest {
  readonly requestedBy: string;
  readonly principal: PermissionPrincipal;
  readonly queries: readonly AssistantContextQuery[];
}

export interface AssistantContextBundle {
  readonly status: AssistantContextBundleStatus;
  readonly resolutions: readonly AssistantContextResolution[];
  readonly contexts: readonly IntelligenceContext[];
  readonly messages: readonly string[];
}

function scopeFromQuery(query: AssistantContextQuery): PermissionScope {
  return {
    domain: query.type.toLowerCase(),
    entityType: query.type,
    ...(query.entityId === undefined ? {} : { entityId: query.entityId }),
    ...(query.businessLine === undefined
      ? {}
      : { businessLine: query.businessLine }),
  };
}

function readPermissionRequest(query: AssistantContextQuery): PermissionRequest {
  return {
    permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
    actionClass: 'READ',
    scope: scopeFromQuery(query),
  };
}

function sourcesForType(
  sources: readonly AssistantContextSource[],
  type: AssistantContextType,
): readonly AssistantContextSource[] {
  return sources.filter((source) => source.type === type);
}

export async function resolveAssistantContext(
  dependencies: AssistantContextResolverDependencies,
  request: AssistantContextResolverRequest,
): Promise<AssistantContextResolution> {
  const permissionDecision = evaluatePermission(
    request.principal,
    readPermissionRequest(request.query),
  );

  if (!permissionDecision.allowed) {
    return {
      status: 'PERMISSION_DENIED',
      query: request.query,
      permissionDecision,
      messages: [
        `Context read denied: ${permissionDecision.permission} (${permissionDecision.reason}).`,
        'No context source was executed.',
      ],
    };
  }

  const matchingSources = sourcesForType(
    dependencies.sources,
    request.query.type,
  );

  if (matchingSources.length === 0) {
    return {
      status: 'DEPENDENCY_FAILED',
      query: request.query,
      permissionDecision,
      messages: [
        `Missing context source for ${request.query.type}.`,
        'No context projection was produced.',
      ],
    };
  }

  if (matchingSources.length > 1) {
    return {
      status: 'DEPENDENCY_FAILED',
      query: request.query,
      permissionDecision,
      messages: [
        `Duplicate context sources for ${request.query.type}.`,
        'Context resolution requires exactly one source per type.',
      ],
    };
  }

  const source = matchingSources[0];
  if (!source) {
    return {
      status: 'DEPENDENCY_FAILED',
      query: request.query,
      permissionDecision,
      messages: ['Context source disappeared during resolution.'],
    };
  }

  let projection: AssistantContextProjection;
  try {
    projection = await source.resolve({
      requestedBy: request.requestedBy,
      query: request.query,
    });
  } catch (error) {
    return {
      status: 'DEPENDENCY_FAILED',
      query: request.query,
      permissionDecision,
      messages: [
        `Context source failed for ${request.query.type}.`,
        error instanceof Error ? error.message : 'Unknown context source failure.',
      ],
    };
  }

  const context: IntelligenceContext = {
    contextId: request.query.contextId,
    type: request.query.type,
    ...(request.query.entityId === undefined
      ? {}
      : { entityId: request.query.entityId }),
    ...(request.query.businessLine === undefined
      ? {}
      : { businessLine: request.query.businessLine }),
    attributes: projection.attributes,
  };

  return {
    status: 'SUCCESS',
    query: request.query,
    permissionDecision,
    context,
    source: projection.source,
    messages: [`Context resolved from ${projection.source}.`],
  };
}

export async function resolveAssistantContextBundle(
  dependencies: AssistantContextResolverDependencies,
  request: AssistantContextBundleRequest,
): Promise<AssistantContextBundle> {
  if (request.queries.length === 0) {
    return {
      status: 'NO_CONTEXT',
      resolutions: [],
      contexts: [],
      messages: ['No context queries were requested.'],
    };
  }

  const resolutions: AssistantContextResolution[] = [];

  for (const query of request.queries) {
    resolutions.push(
      await resolveAssistantContext(dependencies, {
        requestedBy: request.requestedBy,
        principal: request.principal,
        query,
      }),
    );
  }

  const successful = resolutions.filter(
    (resolution) => resolution.status === 'SUCCESS',
  );
  const contexts = successful.flatMap((resolution) =>
    resolution.context === undefined ? [] : [resolution.context],
  );

  if (successful.length === resolutions.length) {
    return {
      status: 'SUCCESS',
      resolutions,
      contexts,
      messages: ['All requested contexts were resolved.'],
    };
  }

  if (successful.length > 0) {
    return {
      status: 'PARTIAL_SUCCESS',
      resolutions,
      contexts,
      messages: [
        `${successful.length} of ${resolutions.length} requested contexts were resolved.`,
      ],
    };
  }

  const hasPermissionDenied = resolutions.some(
    (resolution) => resolution.status === 'PERMISSION_DENIED',
  );

  return {
    status: hasPermissionDenied ? 'PERMISSION_DENIED' : 'DEPENDENCY_FAILED',
    resolutions,
    contexts: [],
    messages: hasPermissionDenied
      ? ['No requested context could be resolved because at least one read was denied.']
      : ['No requested context could be resolved because context dependencies failed.'],
  };
}
