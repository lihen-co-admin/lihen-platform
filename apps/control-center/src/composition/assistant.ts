import {
  INTELLIGENCE_PERMISSION,
  runLihenAssistantTurn,
  type AssistantContextSource,
  type LihenAssistantTurn,
  type PermissionPrincipal,
} from '@lihen/intelligence-core';
import {
  createGetProductByIdQuery,
  type ProductDetailDTO,
} from '@lihen/products';
import { productsComposition } from './products';

/**
 * Narrow Product Master read boundary used by the Assistant composition.
 *
 * The Assistant does not own Product data and must not query Supabase directly.
 */
export interface AssistantProductReader {
  findById(productId: string): Promise<ProductDetailDTO | null>;
}

export interface ControlCenterAssistantProductTurnRequest {
  readonly requestedBy: string;
  readonly authorized: boolean;
  readonly prompt: string;
  readonly productId: string;
  readonly requestId?: string;
  readonly correlationId?: string;
}

export interface ControlCenterAssistantComposition {
  runProductTurn(
    request: ControlCenterAssistantProductTurnRequest,
  ): Promise<LihenAssistantTurn>;
}

/**
 * Intelligence principal for the current Assistant runtime.
 *
 * It intentionally receives only the permissions required to read governed
 * context and execute the ASSISTANT analysis capability.
 *
 * Human identity remains separate in requestedBy.
 */
export function createControlCenterAssistantPrincipal(): PermissionPrincipal {
  return {
    actorId: 'lihen-assistant-intelligence',
    actorType: 'INTELLIGENCE',
    grants: [
      {
        permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
        effect: 'ALLOW',
        source: 'control-center-assistant-policy',
      },
      {
        permission: INTELLIGENCE_PERMISSION.ANALYZE,
        effect: 'ALLOW',
        source: 'control-center-assistant-policy',
      },
    ],
  };
}

export function createProductAssistantContextSource(
  reader: AssistantProductReader,
): AssistantContextSource {
  return {
    type: 'PRODUCT',

    async resolve({ query }) {
      const productId = query.entityId?.trim();

      if (!productId) {
        throw new Error('PRODUCT_ENTITY_ID_REQUIRED');
      }

      const product = await reader.findById(productId);

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
  };
}

function createDefaultProductReader(): AssistantProductReader {
  return {
    findById(productId) {
      return productsComposition.getProductById.execute(
        createGetProductByIdQuery(productId),
      );
    },
  };
}

export function createControlCenterAssistantComposition(
  reader: AssistantProductReader = createDefaultProductReader(),
): ControlCenterAssistantComposition {
  const productSource = createProductAssistantContextSource(reader);
  const principal = createControlCenterAssistantPrincipal();

  return {
    async runProductTurn(request) {
      if (!request.authorized) {
        return {
          status: 'PERMISSION_DENIED',
          recommendations: [],
          messages: [
            'CONTROL_CENTER_AUTHORIZATION_REQUIRED',
            'No Assistant context source was executed.',
          ],
        };
      }

      const requestedBy = request.requestedBy.trim();
      if (!requestedBy) {
        return {
          status: 'PERMISSION_DENIED',
          recommendations: [],
          messages: [
            'CONTROL_CENTER_REQUESTED_BY_REQUIRED',
            'No Assistant context source was executed.',
          ],
        };
      }

      const productId = request.productId.trim();

      return runLihenAssistantTurn(
        {
          context: {
            sources: [productSource],
          },
          // ModelPort intentionally remains unconfigured in this DEV foundation.
        },
        {
          requestId:
            request.requestId
            ?? `assistant-request:${crypto.randomUUID()}`,
          correlationId:
            request.correlationId
            ?? `assistant-correlation:${crypto.randomUUID()}`,
          requestedBy,
          principal,
          prompt: request.prompt,
          contextQuery: {
            contextId: `assistant-product:${productId}`,
            type: 'PRODUCT',
            entityId: productId,
          },
        },
      );
    },
  };
}

export const assistantComposition =
  createControlCenterAssistantComposition();
