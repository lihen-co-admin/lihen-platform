import { describe, expect, it } from 'vitest';
import {
  createControlCenterAssistantComposition,
  createControlCenterAssistantPrincipal,
  createProductAssistantContextSource,
  type AssistantProductReader,
} from '../src/composition/assistant';

const product = {
  id: 'product-1',
  sku: 'BC-001',
  catalogCode: 'LIHEN-BC-001',
  slug: 'producto-lihen',
  name: 'Producto LIHEN',
  businessLine: 'BEAUTY_CARE' as const,
  brandId: 'brand-1',
  brandName: 'Marca LIHEN',
  categoryId: 'category-1',
  categoryName: 'Beauty Care',
  status: 'ACTIVE' as const,
  salePrice: {
    amount: 25000,
    currency: 'COP',
  },
};

describe('Control Center Assistant composition', () => {
  it('uses a least-privilege Intelligence principal', () => {
    const principal = createControlCenterAssistantPrincipal();

    expect(principal.actorType).toBe('INTELLIGENCE');
    expect(principal.grants).toEqual([
      expect.objectContaining({
        permission: 'intelligence.read_context',
        effect: 'ALLOW',
      }),
      expect.objectContaining({
        permission: 'intelligence.analyze',
        effect: 'ALLOW',
      }),
    ]);
    expect(principal.grants).toHaveLength(2);
  });

  it('projects Product Master through the existing read boundary', async () => {
    const reader: AssistantProductReader = {
      async findById(productId) {
        expect(productId).toBe('product-1');
        return product;
      },
    };

    const source = createProductAssistantContextSource(reader);

    const projection = await source.resolve({
      requestedBy: 'human-1',
      query: {
        contextId: 'ctx-1',
        type: 'PRODUCT',
        entityId: 'product-1',
      },
    });

    expect(projection.source).toBe('ProductMaster:GetProductById');
    expect(projection.attributes).toEqual({
      product,
    });
  });

  it('resolves governed Product context before reporting missing ModelPort', async () => {
    let reads = 0;

    const reader: AssistantProductReader = {
      async findById() {
        reads += 1;
        return product;
      },
    };

    const composition =
      createControlCenterAssistantComposition(reader);

    const turn = await composition.runProductTurn({
      requestedBy: 'human-1',
      authorized: true,
      prompt: '¿Qué debo revisar de este producto?',
      productId: 'product-1',
      requestId: 'request-1',
      correlationId: 'correlation-1',
    });

    expect(reads).toBe(1);
    expect(turn.status).toBe('PROVIDER_NOT_CONFIGURED');
    expect(turn.contextSource).toBe('ProductMaster:GetProductById');
    expect(turn.context?.type).toBe('PRODUCT');
    expect(turn.context?.attributes).toEqual({
      product,
    });
    expect(turn.orchestration).toBeUndefined();
    expect(turn.recommendations).toEqual([]);
  });

  it('fails closed before reading Product context when admin authorization is absent', async () => {
    let reads = 0;

    const reader: AssistantProductReader = {
      async findById() {
        reads += 1;
        return product;
      },
    };

    const composition =
      createControlCenterAssistantComposition(reader);

    const turn = await composition.runProductTurn({
      requestedBy: 'human-1',
      authorized: false,
      prompt: 'Consulta',
      productId: 'product-1',
      requestId: 'request-denied',
      correlationId: 'correlation-denied',
    });

    expect(turn.status).toBe('PERMISSION_DENIED');
    expect(turn.messages).toContain(
      'CONTROL_CENTER_AUTHORIZATION_REQUIRED',
    );
    expect(reads).toBe(0);
  });

  it('fails closed when the Product Master cannot resolve the requested product', async () => {
    const reader: AssistantProductReader = {
      async findById() {
        return null;
      },
    };

    const composition =
      createControlCenterAssistantComposition(reader);

    const turn = await composition.runProductTurn({
      requestedBy: 'human-1',
      authorized: true,
      prompt: 'Consulta',
      productId: 'missing-product',
      requestId: 'request-missing',
      correlationId: 'correlation-missing',
    });

    expect(turn.status).toBe('DEPENDENCY_FAILED');
    expect(turn.messages.join(' ')).toContain(
      'PRODUCT_NOT_FOUND',
    );
  });
});
