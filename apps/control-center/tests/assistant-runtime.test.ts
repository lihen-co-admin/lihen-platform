import { describe, expect, it, vi } from 'vitest';
import type { LihenAssistantTurn } from '@lihen/intelligence-core';
import {
  createAssistantRuntimeInvoker,
  type AssistantEdgeFunctionClient,
} from '../src/composition/assistant-runtime';

function fakeClient(
  result: {
    readonly data: unknown;
    readonly error: {
      readonly message?: string;
    } | null;
  },
) {
  const invoke = vi.fn().mockResolvedValue(result);

  const client = {
    functions: {
      invoke,
    },
  } as unknown as AssistantEdgeFunctionClient;

  return {
    client,
    invoke,
  };
}

describe('Control Center Assistant runtime adapter', () => {
  it('fails closed before Edge invocation when productId is empty', async () => {
    const { client, invoke } = fakeClient({
      data: null,
      error: null,
    });

    const adapter =
      createAssistantRuntimeInvoker(client);

    await expect(
      adapter.invokeProductTurn({
        productId: '   ',
        prompt: 'Consulta',
      }),
    ).rejects.toThrow(
      'LIHEN_ASSISTANT_PRODUCT_ID_REQUIRED',
    );

    expect(invoke).not.toHaveBeenCalled();
  });

  it('fails closed before Edge invocation when prompt is empty', async () => {
    const { client, invoke } = fakeClient({
      data: null,
      error: null,
    });

    const adapter =
      createAssistantRuntimeInvoker(client);

    await expect(
      adapter.invokeProductTurn({
        productId: 'product-1',
        prompt: '   ',
      }),
    ).rejects.toThrow(
      'LIHEN_ASSISTANT_PROMPT_REQUIRED',
    );

    expect(invoke).not.toHaveBeenCalled();
  });

  it('invokes only the intelligence-runtime ASSISTANT route', async () => {
    const assistant: LihenAssistantTurn = {
      status: 'PROVIDER_NOT_CONFIGURED',
      contextSource: 'ProductMaster:GetProductById',
      recommendations: [],
      messages: [
        'LIHEN Assistant context is ready, but no ModelPort adapter is configured.',
      ],
    };

    const { client, invoke } = fakeClient({
      data: {
        runtime: 'LIHEN_INTELLIGENCE',
        action: 'ASSISTANT',
        roleCode: 'ADMIN',
        assistant,
      },
      error: null,
    });

    const adapter =
      createAssistantRuntimeInvoker(client);

    const result =
      await adapter.invokeProductTurn({
        productId: ' product-1 ',
        prompt: ' ¿Qué debo revisar? ',
      });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(
      'intelligence-runtime',
      {
        body: {
          action: 'ASSISTANT',
          productId: 'product-1',
          prompt: '¿Qué debo revisar?',
        },
      },
    );

    expect(result).toBe(assistant);
  });

  it('does not accept Product context from the browser payload', async () => {
    const assistant: LihenAssistantTurn = {
      status: 'PROVIDER_NOT_CONFIGURED',
      recommendations: [],
      messages: [],
    };

    const { client, invoke } = fakeClient({
      data: {
        runtime: 'LIHEN_INTELLIGENCE',
        action: 'ASSISTANT',
        roleCode: 'OWNER',
        assistant,
      },
      error: null,
    });

    const adapter =
      createAssistantRuntimeInvoker(client);

    await adapter.invokeProductTurn({
      productId: 'product-1',
      prompt: 'Consulta',
    });

    const [, options] = invoke.mock.calls[0] as [
      string,
      {
        body: Record<string, unknown>;
      },
    ];

    expect(Object.keys(options.body).sort()).toEqual([
      'action',
      'productId',
      'prompt',
    ]);

    expect(options.body).not.toHaveProperty('context');
    expect(options.body).not.toHaveProperty('product');
    expect(options.body).not.toHaveProperty('requestedBy');
    expect(options.body).not.toHaveProperty('authorized');
  });

  it('surfaces Edge invocation failure as dependency failure input', async () => {
    const { client } = fakeClient({
      data: null,
      error: {
        message: 'Function returned a non-2xx status code',
      },
    });

    const adapter =
      createAssistantRuntimeInvoker(client);

    await expect(
      adapter.invokeProductTurn({
        productId: 'product-1',
        prompt: 'Consulta',
      }),
    ).rejects.toThrow(
      'LIHEN_ASSISTANT_RUNTIME_INVOKE_FAILED:Function returned a non-2xx status code',
    );
  });

  it('fails closed on an invalid runtime response', async () => {
    const { client } = fakeClient({
      data: {
        runtime: 'OTHER_RUNTIME',
        action: 'ASSISTANT',
      },
      error: null,
    });

    const adapter =
      createAssistantRuntimeInvoker(client);

    await expect(
      adapter.invokeProductTurn({
        productId: 'product-1',
        prompt: 'Consulta',
      }),
    ).rejects.toThrow(
      'LIHEN_ASSISTANT_RUNTIME_INVALID_RESPONSE',
    );
  });
});
