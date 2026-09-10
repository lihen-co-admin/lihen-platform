import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  createGroqModelPort,
} from '../../supabase/functions/intelligence-runtime/providers/groq-model';

const request = {
  correlationId: 'corr-1',
  requestedBy: 'human-1',
  context: {
    contextId: 'ctx-1',
  },
  messages: [
    {
      role: 'SYSTEM' as const,
      content: 'System rule',
    },
    {
      role: 'USER' as const,
      content: 'Consulta',
    },
  ],
  responseFormat: 'TEXT' as const,
  temperature: 0.2,
};

describe('Groq ModelPort provider', () => {
  it('requires a server-side API key', () => {
    expect(() =>
      createGroqModelPort({
        apiKey: '   ',
      }),
    ).toThrow(
      'GROQ_API_KEY_NOT_CONFIGURED',
    );
  });

  it('uses the frozen FREE-ONLY DEV model and chat endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'req-1',
          choices: [
            {
              message: {
                content: 'Respuesta LIHEN',
              },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const port = createGroqModelPort({
      apiKey: 'test-key',
      fetchImpl,
    });

    const result = await port.complete(request);

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] =
      fetchImpl.mock.calls[0] as [
        string,
        RequestInit,
      ];

    expect(url).toBe(
      'https://api.groq.com/openai/v1/chat/completions',
    );

    expect(
      (init.headers as Record<string, string>)
        .Authorization,
    ).toBe('Bearer test-key');

    const body = JSON.parse(
      String(init.body),
    ) as Record<string, unknown>;

    expect(body.model).toBe(
      'openai/gpt-oss-20b',
    );

    expect(body.messages).toEqual([
      {
        role: 'system',
        content: 'System rule',
      },
      {
        role: 'user',
        content: 'Consulta',
      },
    ]);

    expect(result.status).toBe('SUCCESS');
    expect(result.data?.text).toBe(
      'Respuesta LIHEN',
    );
    expect(result.trace?.providerRef).toBe(
      'groq',
    );
    expect(result.trace?.usage).toEqual({
      inputUnits: 100,
      outputUnits: 20,
    });
  });

  it('never sends LIHEN requestedBy or context as separate provider fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'ok',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const port = createGroqModelPort({
      apiKey: 'test-key',
      fetchImpl,
    });

    await port.complete(request);

    const [, init] =
      fetchImpl.mock.calls[0] as [
        string,
        RequestInit,
      ];

    const body = JSON.parse(
      String(init.body),
    ) as Record<string, unknown>;

    expect(body).not.toHaveProperty(
      'requestedBy',
    );
    expect(body).not.toHaveProperty(
      'context',
    );
    expect(body).not.toHaveProperty(
      'correlationId',
    );
  });

  it('maps HTTP 429 to RATE_LIMITED', async () => {
    const port = createGroqModelPort({
      apiKey: 'test-key',
      fetchImpl: vi.fn().mockResolvedValue(
        new Response('', {
          status: 429,
        }),
      ),
    });

    const result = await port.complete(request);

    expect(result.status).toBe(
      'RATE_LIMITED',
    );
  });

  it('maps provider 5xx to UNAVAILABLE', async () => {
    const port = createGroqModelPort({
      apiKey: 'test-key',
      fetchImpl: vi.fn().mockResolvedValue(
        new Response('', {
          status: 503,
        }),
      ),
    });

    const result = await port.complete(request);

    expect(result.status).toBe(
      'UNAVAILABLE',
    );
  });

  it('maps network failures to UNAVAILABLE', async () => {
    const port = createGroqModelPort({
      apiKey: 'test-key',
      fetchImpl: vi.fn().mockRejectedValue(
        new Error('network down'),
      ),
    });

    const result = await port.complete(request);

    expect(result.status).toBe(
      'UNAVAILABLE',
    );
    expect(result.messages).toContain(
      'GROQ_PROVIDER_NETWORK_FAILED',
    );
  });

  it('fails closed on empty successful output', async () => {
    const port = createGroqModelPort({
      apiKey: 'test-key',
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: '   ',
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type':
                'application/json',
            },
          },
        ),
      ),
    });

    const result = await port.complete(request);

    expect(result.status).toBe(
      'NO_RESULT',
    );
  });

  it('supports the existing JSON ModelPort response contract', async () => {
    const port = createGroqModelPort({
      apiKey: 'test-key',
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"recommendation":"review"}',
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type':
                'application/json',
            },
          },
        ),
      ),
    });

    const result = await port.complete({
      ...request,
      responseFormat: 'JSON',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.data?.structured).toEqual({
      recommendation: 'review',
    });
  });
});
