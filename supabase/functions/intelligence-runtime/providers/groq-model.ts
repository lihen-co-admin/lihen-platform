export type GroqModelMessageRole =
  | 'SYSTEM'
  | 'USER'
  | 'ASSISTANT'
  | 'TOOL';

export interface GroqModelMessage {
  readonly role: GroqModelMessageRole;
  readonly content: string;
}

export interface GroqModelCompletionRequest {
  readonly correlationId: string;
  readonly requestedBy: string;
  readonly context: Readonly<Record<string, unknown>>;
  readonly messages: readonly GroqModelMessage[];
  readonly responseFormat?: 'TEXT' | 'JSON';
  readonly temperature?: number;
}

export interface GroqProviderResult {
  readonly status:
    | 'SUCCESS'
    | 'PARTIAL'
    | 'NO_RESULT'
    | 'RATE_LIMITED'
    | 'UNAVAILABLE'
    | 'FAILED';
  readonly data?: {
    readonly text: string;
    readonly structured?: Readonly<Record<string, unknown>>;
  };
  readonly messages: readonly string[];
  readonly trace?: {
    readonly providerRef: string;
    readonly modelOrEngine?: string;
    readonly requestRef?: string;
    readonly durationMs?: number;
    readonly usage?: {
      readonly inputUnits?: number;
      readonly outputUnits?: number;
    };
  };
}

export interface GroqModelPort {
  readonly descriptor: {
    readonly toolId: string;
    readonly kind: 'MODEL';
    readonly name: string;
    readonly version: string;
    readonly description: string;
    readonly readOnly: boolean;
  };
  complete(
    request: GroqModelCompletionRequest,
  ): Promise<GroqProviderResult>;
}

export interface GroqModelProviderOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly fetchImpl?: typeof fetch;
}

interface GroqChatResponse {
  readonly id?: unknown;
  readonly choices?: unknown;
  readonly usage?: {
    readonly prompt_tokens?: unknown;
    readonly completion_tokens?: unknown;
  };
}

const DEFAULT_MODEL = 'openai/gpt-oss-20b';
const GROQ_CHAT_URL =
  'https://api.groq.com/openai/v1/chat/completions';

function mapRole(
  role: GroqModelMessageRole,
): 'system' | 'user' | 'assistant' | 'tool' {
  return role.toLowerCase() as
    | 'system'
    | 'user'
    | 'assistant'
    | 'tool';
}

function numericUsage(
  value: unknown,
): number | undefined {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    ? value
    : undefined;
}

function responseText(
  payload: GroqChatResponse,
): string {
  if (!Array.isArray(payload.choices)) return '';

  const first = payload.choices[0];

  if (
    !first
    || typeof first !== 'object'
    || Array.isArray(first)
  ) {
    return '';
  }

  const message =
    (first as Record<string, unknown>).message;

  if (
    !message
    || typeof message !== 'object'
    || Array.isArray(message)
  ) {
    return '';
  }

  const content =
    (message as Record<string, unknown>).content;

  return typeof content === 'string'
    ? content.trim()
    : '';
}

export function createGroqModelPort(
  options: GroqModelProviderOptions,
): GroqModelPort {
  const apiKey = options.apiKey.trim();
  const model = options.model?.trim() || DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY_NOT_CONFIGURED');
  }

  return {
    descriptor: {
      toolId: 'groq-chat-completions',
      kind: 'MODEL',
      name: 'Groq Chat Completions',
      version: '1',
      description:
        'Server-side Groq ModelPort for LIHEN Intelligence.',
      readOnly: true,
    },

    async complete(request) {
      const startedAt = performance.now();

      let response: Response;

      try {
        response = await fetchImpl(
          GROQ_CHAT_URL,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: request.messages.map(
                (message) => ({
                  role: mapRole(message.role),
                  content: message.content,
                }),
              ),
              temperature:
                request.temperature ?? 0.2,
              ...(request.responseFormat === 'JSON'
                ? {
                    response_format: {
                      type: 'json_object',
                    },
                  }
                : {}),
            }),
          },
        );
      } catch (error) {
        return {
          status: 'UNAVAILABLE',
          messages: [
            'GROQ_PROVIDER_NETWORK_FAILED',
            error instanceof Error
              ? error.message
              : 'UNKNOWN_NETWORK_FAILURE',
          ],
          trace: {
            providerRef: 'groq',
            modelOrEngine: model,
            durationMs:
              performance.now() - startedAt,
          },
        };
      }

      const requestRef =
        response.headers.get('x-request-id')
        ?? response.headers.get('request-id')
        ?? undefined;

      const durationMs =
        performance.now() - startedAt;

      if (response.status === 429) {
        return {
          status: 'RATE_LIMITED',
          messages: [
            'GROQ_PROVIDER_RATE_LIMITED',
          ],
          trace: {
            providerRef: 'groq',
            modelOrEngine: model,
            ...(requestRef ? { requestRef } : {}),
            durationMs,
          },
        };
      }

      if (response.status >= 500) {
        return {
          status: 'UNAVAILABLE',
          messages: [
            `GROQ_PROVIDER_UNAVAILABLE:${response.status}`,
          ],
          trace: {
            providerRef: 'groq',
            modelOrEngine: model,
            ...(requestRef ? { requestRef } : {}),
            durationMs,
          },
        };
      }

      if (!response.ok) {
        const detail =
          await response.text().catch(() => '');

        return {
          status: 'FAILED',
          messages: [
            `GROQ_PROVIDER_FAILED:${response.status}:${
              detail.slice(0, 300)
            }`,
          ],
          trace: {
            providerRef: 'groq',
            modelOrEngine: model,
            ...(requestRef ? { requestRef } : {}),
            durationMs,
          },
        };
      }

      let payload: GroqChatResponse;

      try {
        payload =
          await response.json() as GroqChatResponse;
      } catch {
        return {
          status: 'FAILED',
          messages: [
            'GROQ_PROVIDER_INVALID_JSON',
          ],
          trace: {
            providerRef: 'groq',
            modelOrEngine: model,
            ...(requestRef ? { requestRef } : {}),
            durationMs,
          },
        };
      }

      const text = responseText(payload);

      const inputUnits =
        numericUsage(payload.usage?.prompt_tokens);

      const outputUnits =
        numericUsage(
          payload.usage?.completion_tokens,
        );

      const trace = {
        providerRef: 'groq',
        modelOrEngine: model,
        ...(typeof payload.id === 'string'
          && payload.id.trim()
          ? { requestRef: payload.id.trim() }
          : requestRef
            ? { requestRef }
            : {}),
        durationMs,
        ...(inputUnits !== undefined
          || outputUnits !== undefined
          ? {
              usage: {
                ...(inputUnits !== undefined
                  ? { inputUnits }
                  : {}),
                ...(outputUnits !== undefined
                  ? { outputUnits }
                  : {}),
              },
            }
          : {}),
      };

      if (!text) {
        return {
          status: 'NO_RESULT',
          messages: [
            'GROQ_PROVIDER_EMPTY_RESULT',
          ],
          trace,
        };
      }

      if (request.responseFormat === 'JSON') {
        try {
          const structured =
            JSON.parse(text) as unknown;

          if (
            !structured
            || typeof structured !== 'object'
            || Array.isArray(structured)
          ) {
            throw new Error(
              'JSON_RESPONSE_NOT_OBJECT',
            );
          }

          return {
            status: 'SUCCESS',
            data: {
              text,
              structured:
                structured as Readonly<
                  Record<string, unknown>
                >,
            },
            messages: [],
            trace,
          };
        } catch {
          return {
            status: 'FAILED',
            messages: [
              'GROQ_PROVIDER_INVALID_STRUCTURED_RESULT',
            ],
            trace,
          };
        }
      }

      return {
        status: 'SUCCESS',
        data: {
          text,
        },
        messages: [],
        trace,
      };
    },
  };
}
