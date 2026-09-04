import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_CONTEXT_TYPES,
  INTELLIGENCE_PERMISSION,
  resolveAssistantContext,
  resolveAssistantContextBundle,
} from '../src';
import type {
  AssistantContextSource,
  PermissionPrincipal,
} from '../src';

const allowedPrincipal: PermissionPrincipal = {
  actorId: 'intelligence-assistant',
  actorType: 'INTELLIGENCE',
  grants: [
    {
      permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
      effect: 'ALLOW',
      source: 'test',
    },
  ],
};

const deniedPrincipal: PermissionPrincipal = {
  actorId: 'intelligence-assistant',
  actorType: 'INTELLIGENCE',
  grants: [],
};

function productSource(
  onResolve?: () => void,
): AssistantContextSource {
  return {
    type: 'PRODUCT',
    async resolve(request) {
      onResolve?.();
      return {
        source: 'ProductRepository',
        attributes: {
          name: 'Producto LIHEN',
          requestedEntityId: request.query.entityId ?? null,
        },
      };
    },
  };
}

describe('GAP-033 Assistant Context Resolver', () => {
  it('supports exactly the governed context families defined by the master scope', () => {
    expect(ASSISTANT_CONTEXT_TYPES).toEqual([
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
    ]);
    expect(ASSISTANT_CONTEXT_TYPES).not.toContain('GLOBAL');
    expect(ASSISTANT_CONTEXT_TYPES).not.toContain('DOCUMENT');
    expect(ASSISTANT_CONTEXT_TYPES).not.toContain('ASSET');
  });

  it('resolves a read projection only after intelligence.read_context is allowed', async () => {
    const resolution = await resolveAssistantContext(
      { sources: [productSource()] },
      {
        requestedBy: 'owner-user',
        principal: allowedPrincipal,
        query: {
          contextId: 'ctx-product-1',
          type: 'PRODUCT',
          entityId: 'product-123',
          businessLine: 'BEAUTY_CARE',
        },
      },
    );

    expect(resolution.status).toBe('SUCCESS');
    expect(resolution.permissionDecision.allowed).toBe(true);
    expect(resolution.source).toBe('ProductRepository');
    expect(resolution.context).toEqual({
      contextId: 'ctx-product-1',
      type: 'PRODUCT',
      entityId: 'product-123',
      businessLine: 'BEAUTY_CARE',
      attributes: {
        name: 'Producto LIHEN',
        requestedEntityId: 'product-123',
      },
    });
  });

  it('is default-deny and does not execute a context source when permission is missing', async () => {
    let calls = 0;

    const resolution = await resolveAssistantContext(
      {
        sources: [
          productSource(() => {
            calls += 1;
          }),
        ],
      },
      {
        requestedBy: 'owner-user',
        principal: deniedPrincipal,
        query: {
          contextId: 'ctx-product-denied',
          type: 'PRODUCT',
          entityId: 'product-123',
        },
      },
    );

    expect(resolution.status).toBe('PERMISSION_DENIED');
    expect(resolution.permissionDecision.reason).toBe('MISSING_GRANT');
    expect(calls).toBe(0);
    expect(resolution.context).toBeUndefined();
  });

  it('fails closed when a context source is missing or duplicated', async () => {
    const request = {
      requestedBy: 'owner-user',
      principal: allowedPrincipal,
      query: {
        contextId: 'ctx-product-closed',
        type: 'PRODUCT' as const,
        entityId: 'product-123',
      },
    };

    const missing = await resolveAssistantContext(
      { sources: [] },
      request,
    );
    expect(missing.status).toBe('DEPENDENCY_FAILED');
    expect(missing.messages.join(' ')).toContain('Missing context source');

    const duplicated = await resolveAssistantContext(
      { sources: [productSource(), productSource()] },
      request,
    );
    expect(duplicated.status).toBe('DEPENDENCY_FAILED');
    expect(duplicated.messages.join(' ')).toContain('Duplicate context sources');
  });

  it('turns context source failures into dependency failures instead of bypassing governance', async () => {
    const failingSource: AssistantContextSource = {
      type: 'PRODUCT',
      async resolve() {
        throw new Error('PRODUCT_CONTEXT_SOURCE_UNAVAILABLE');
      },
    };

    const resolution = await resolveAssistantContext(
      { sources: [failingSource] },
      {
        requestedBy: 'owner-user',
        principal: allowedPrincipal,
        query: {
          contextId: 'ctx-product-failure',
          type: 'PRODUCT',
        },
      },
    );

    expect(resolution.status).toBe('DEPENDENCY_FAILED');
    expect(resolution.messages).toContain('PRODUCT_CONTEXT_SOURCE_UNAVAILABLE');
  });

  it('resolves multi-domain bundles without converting a partial result into authority', async () => {
    const auditSource: AssistantContextSource = {
      type: 'AUDIT',
      async resolve() {
        return {
          source: 'AuditReadModel',
          attributes: { integrityStatus: 'PASS' },
        };
      },
    };

    const bundle = await resolveAssistantContextBundle(
      {
        sources: [productSource(), auditSource],
      },
      {
        requestedBy: 'owner-user',
        principal: allowedPrincipal,
        queries: [
          {
            contextId: 'ctx-product-bundle',
            type: 'PRODUCT',
            entityId: 'product-123',
          },
          {
            contextId: 'ctx-audit-bundle',
            type: 'AUDIT',
          },
          {
            contextId: 'ctx-finance-bundle',
            type: 'FINANCE',
          },
        ],
      },
    );

    expect(bundle.status).toBe('PARTIAL_SUCCESS');
    expect(bundle.contexts).toHaveLength(2);
    expect(bundle.resolutions.map((item) => item.status)).toEqual([
      'SUCCESS',
      'SUCCESS',
      'DEPENDENCY_FAILED',
    ]);
  });

  it('returns NO_CONTEXT for an empty bundle', async () => {
    const bundle = await resolveAssistantContextBundle(
      { sources: [] },
      {
        requestedBy: 'owner-user',
        principal: allowedPrincipal,
        queries: [],
      },
    );

    expect(bundle.status).toBe('NO_CONTEXT');
    expect(bundle.contexts).toEqual([]);
  });
});
