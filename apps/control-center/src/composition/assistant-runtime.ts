import { getBrowserSupabaseClient } from '@lihen/database';
import type { LihenAssistantTurn } from '@lihen/intelligence-core';

export interface AssistantRuntimeProductTurnRequest {
  readonly prompt: string;
  readonly productId: string;
}

export interface AssistantRuntimeResponse {
  readonly runtime: string;
  readonly action: string;
  readonly roleCode: string;
  readonly assistant: LihenAssistantTurn;
}

export interface AssistantRuntimeInvoker {
  invokeProductTurn(
    request: AssistantRuntimeProductTurnRequest,
  ): Promise<LihenAssistantTurn>;
}

interface EdgeInvokeResult<T> {
  readonly data: T | null;
  readonly error: {
    readonly message?: string;
  } | null;
}

export interface AssistantEdgeFunctionClient {
  readonly functions: {
    invoke<T>(
      functionName: string,
      options: {
        readonly body: Readonly<Record<string, unknown>>;
      },
    ): PromiseLike<EdgeInvokeResult<T>>;
  };
}

export function createAssistantRuntimeInvoker(
  client: AssistantEdgeFunctionClient,
): AssistantRuntimeInvoker {
  return {
    async invokeProductTurn(request) {
      const productId = request.productId.trim();
      const prompt = request.prompt.trim();

      if (!productId) {
        throw new Error(
          'LIHEN_ASSISTANT_PRODUCT_ID_REQUIRED',
        );
      }

      if (!prompt) {
        throw new Error(
          'LIHEN_ASSISTANT_PROMPT_REQUIRED',
        );
      }

      const { data, error } =
        await client.functions.invoke<AssistantRuntimeResponse>(
          'intelligence-runtime',
          {
            body: {
              action: 'ASSISTANT',
              productId,
              prompt,
            },
          },
        );

      if (error) {
        throw new Error(
          `LIHEN_ASSISTANT_RUNTIME_INVOKE_FAILED:${
            error.message ?? 'UNKNOWN'
          }`,
        );
      }

      if (
        !data
        || data.runtime !== 'LIHEN_INTELLIGENCE'
        || data.action !== 'ASSISTANT'
        || !data.assistant
      ) {
        throw new Error(
          'LIHEN_ASSISTANT_RUNTIME_INVALID_RESPONSE',
        );
      }

      return data.assistant;
    },
  };
}

export function createDefaultAssistantRuntimeInvoker(
  env: Record<string, unknown> = import.meta.env,
): AssistantRuntimeInvoker {
  return createAssistantRuntimeInvoker(
    getBrowserSupabaseClient(env),
  );
}

export const assistantRuntimeInvoker =
  createDefaultAssistantRuntimeInvoker();
