import type {
  ProviderResult,
  SearchPort,
  SearchRequest,
  SearchResultItem,
} from '../../../packages/intelligence-core/src/provider-ports.ts';

export interface GroqSearchProviderOptions {
  readonly apiKey: string;
  readonly enabled?: boolean;
  readonly model?: string;
  readonly fetchImpl?: typeof fetch;
}

interface GroqSearchResponse {
  readonly id?: unknown;
  readonly choices?: unknown;
  readonly usage?: {
    readonly prompt_tokens?: unknown;
    readonly completion_tokens?: unknown;
  };
}

const DEFAULT_MODEL = 'openai/gpt-oss-20b';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

function numericUsage(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function browserSearchStructuredResults(): readonly SearchResultItem[] {
  // Browser Search currently provides model-generated response content, but
  // LIHEN requires concrete structured source URLs before discovery can enter
  // the evidence-fetch pipeline. Never promote model content into evidence.
  return [];
}

export function createGroqSearchPort(options: GroqSearchProviderOptions): SearchPort {
  const apiKey = options.apiKey.trim();
  const model = options.model?.trim() || DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const enabled = options.enabled === true;

  return {
    descriptor: {
      toolId: 'groq-browser-search',
      kind: 'SEARCH',
      name: 'Groq Browser Search',
      version: '1',
      description: 'Server-side read-only Groq SearchPort for LIHEN editorial research.',
      readOnly: true,
    },

    async search(request: SearchRequest): Promise<ProviderResult<readonly SearchResultItem[]>> {
      const startedAt = performance.now();

      const trace = (requestRef?: string) => ({
        providerRef: 'groq',
        modelOrEngine: model,
        ...(requestRef ? { requestRef } : {}),
        durationMs: performance.now() - startedAt,
      });

      if (!enabled) {
        return {
          status: 'UNAVAILABLE',
          messages: ['SEARCH_PROVIDER_NOT_CONFIGURED'],
          trace: trace(),
        };
      }

      if (request.costPolicy !== 'FREE_ONLY') {
        return {
          status: 'FAILED',
          messages: ['GROQ_SEARCH_FREE_ONLY_REQUIRED'],
          trace: trace(),
        };
      }

      if (!apiKey) {
        return {
          status: 'UNAVAILABLE',
          messages: ['GROQ_API_KEY_NOT_CONFIGURED'],
          trace: trace(),
        };
      }

      if (model !== DEFAULT_MODEL) {
        return {
          status: 'FAILED',
          messages: ['GROQ_SEARCH_MODEL_NOT_ALLOWED'],
          trace: trace(),
        };
      }

      if (request.queries.length === 0) {
        return {
          status: 'NO_RESULT',
          data: [],
          messages: ['SEARCH_QUERY_REQUIRED'],
          trace: trace(),
        };
      }

      const queryText = request.queries
        .map(({ query }) => query.trim())
        .filter(Boolean)
        .join('\n');

      if (!queryText) {
        return {
          status: 'NO_RESULT',
          data: [],
          messages: ['SEARCH_QUERY_REQUIRED'],
          trace: trace(),
        };
      }

      let response: Response;

      try {
        response = await fetchImpl(GROQ_CHAT_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content:
                  'Research the exact requested product. Use browser search only. Do not infer missing product facts. Prefer exact product and brand matches. Return web evidence only; LIHEN will independently verify identity, authority and claims.',
              },
              {
                role: 'user',
                content: queryText,
              },
            ],
            temperature: 0,
            reasoning_effort: 'low',
            tool_choice: 'required',
            tools: [
              {
                type: 'browser_search',
              },
            ],
          }),
        });
      } catch (error) {
        return {
          status: 'UNAVAILABLE',
          messages: [
            'GROQ_SEARCH_NETWORK_FAILED',
            error instanceof Error ? error.message : 'UNKNOWN_NETWORK_FAILURE',
          ],
          trace: trace(),
        };
      }

      const requestRef =
        response.headers.get('x-request-id') ?? response.headers.get('request-id') ?? undefined;

      if (response.status === 429) {
        return {
          status: 'RATE_LIMITED',
          messages: ['GROQ_SEARCH_RATE_LIMITED'],
          trace: trace(requestRef),
        };
      }

      if (response.status >= 500) {
        return {
          status: 'UNAVAILABLE',
          messages: [`GROQ_SEARCH_UNAVAILABLE:${response.status}`],
          trace: trace(requestRef),
        };
      }

      if (!response.ok) {
        return {
          status: 'FAILED',
          messages: [`GROQ_SEARCH_FAILED:${response.status}`],
          trace: trace(requestRef),
        };
      }

      let payload: GroqSearchResponse;

      try {
        payload = (await response.json()) as GroqSearchResponse;
      } catch {
        return {
          status: 'FAILED',
          messages: ['GROQ_SEARCH_INVALID_JSON'],
          trace: trace(requestRef),
        };
      }

      const results = browserSearchStructuredResults();

      const inputUnits = numericUsage(payload.usage?.prompt_tokens);
      const outputUnits = numericUsage(payload.usage?.completion_tokens);

      const finalTrace = {
        ...trace(
          typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : requestRef,
        ),
        ...(inputUnits !== undefined || outputUnits !== undefined
          ? {
              usage: {
                ...(inputUnits !== undefined ? { inputUnits } : {}),
                ...(outputUnits !== undefined ? { outputUnits } : {}),
              },
            }
          : {}),
      };

      if (results.length === 0) {
        return {
          status: 'NO_RESULT',
          data: [],
          messages: ['GROQ_BROWSER_SEARCH_STRUCTURED_SOURCES_UNAVAILABLE'],
          trace: finalTrace,
        };
      }

      return {
        status: 'SUCCESS',
        data: results,
        messages: [],
        trace: finalTrace,
      };
    },
  };
}
