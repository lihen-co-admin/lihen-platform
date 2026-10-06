import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const entry = resolve(root, 'supabase/functions/intelligence-runtime/index.ts');
let code: string;

beforeAll(async () => {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'neutral',
    plugins: [
      {
        name: 'forbid-preflight-effects',
        setup(builder) {
          builder.onResolve({ filter: /catalog-pdf-webp-transformer\.ts$/ }, () => ({
            path: 'wasm',
            namespace: 'wasm-fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'wasm-fixture' }, () => ({
            contents:
              'export function convertApprovedPngToCatalogPdfWebp() { throw new Error("UNEXPECTED_IMAGE_TRANSFORM"); }',
            loader: 'js',
          }));
          builder.onResolve({ filter: /^supabase$/ }, () => ({
            path: 'auth',
            namespace: 'fixture',
          }));
          builder.onResolve({ filter: /editorial-research-search\.ts$/ }, () => ({
            path: 'search',
            namespace: 'fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
            contents:
              path === 'auth'
                ? 'export const createClient = globalThis.authClient;'
                : 'export const createEditorialResearchRuntimeDependencies = globalThis.constructSearch;',
            loader: 'js',
          }));
        },
      },
    ],
  });
  code = result.outputFiles[0]!.text;
});

async function request(
  options: {
    role?: string;
    status?: string;
    token?: string;
    user?: boolean;
    enabled?: string;
    env?: Record<string, string>;
  } = {},
) {
  let handler!: (req: Request) => Promise<Response>;
  const network = vi.fn(() => {
    throw new Error('NETWORK_FORBIDDEN');
  });
  const constructSearch = vi.fn(() => {
    throw new Error('SEARCH_CONSTRUCTION_FORBIDDEN');
  });
  const registry = [
    {
      domain: 'private.example',
      brandId: 'secret-brand',
      brand: 'Private brand',
      role: 'OFFICIAL_BRAND',
      verification: {
        evidenceRef: 'secret-registry',
        reason: 'Private review',
        verifiedAt: '2026-09-01',
        expiresAt: '2026-10-01',
      },
    },
  ];
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://auth.example',
    SUPABASE_ANON_KEY: 'secret-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'secret-service-role',
    GROQ_API_KEY: 'secret-groq',
    LIHEN_EDITORIAL_RESEARCH_ENABLED: options.enabled ?? 'false',
    LIHEN_EDITORIAL_RESEARCH_ALLOWED_DOMAINS: 'private.example',
    LIHEN_EDITORIAL_RESEARCH_AUTHORITIES: JSON.stringify(registry),
    LIHEN_EDITORIAL_RESEARCH_FREE_ONLY_EVIDENCE_REF:
      'architecture-reviewed:official-domain-discovery',
    LIHEN_EDITORIAL_RESEARCH_FREE_ONLY_VERIFIED_AT: '2026-09-29',
    ...options.env,
  };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: {
        role_code: options.role ?? 'OWNER',
        authorization_status: options.status ?? 'ACTIVE',
      },
      error: null,
    })),
  };
  const from = vi.fn((table: string) => {
    if (table !== 'profiles') throw new Error('UNEXPECTED_DATA_ACCESS');
    return query;
  });
  const authClient = vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.user === false ? null : { id: 'operator' } },
        error: null,
      })),
    },
    from,
  }));
  runInNewContext(code, {
    Deno: {
      env: { get: (key: string) => env[key] },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
    authClient,
    constructSearch,
    fetch: network,
    Request,
    Response,
    Headers,
    URL,
    console,
  });
  const response = await handler(
    new Request('https://runtime.example', {
      method: 'POST',
      headers: { Authorization: options.token ?? 'Bearer test' },
      body: JSON.stringify({
        action: 'EDITORIAL_RESEARCH_PREFLIGHT',
        enabled: true,
        groqApiKey: 'untrusted',
      }),
    }),
  );
  const body = await response.json();
  expect(network).not.toHaveBeenCalled();
  expect(constructSearch).not.toHaveBeenCalled();
  return { response, body, from };
}

describe('Editorial Research preflight HTTP runtime', () => {
  it.each([
    ['LIHEN_EDITORIAL_RESEARCH_AUTHORITIES', '[]', 'PROVIDER_NOT_CONFIGURED'],
    ['LIHEN_EDITORIAL_RESEARCH_ALLOWED_DOMAINS', '', 'ALLOWLIST_NOT_CONFIGURED'],
    [
      'LIHEN_EDITORIAL_RESEARCH_AUTHORITIES',
      'secret-malformed-json',
      'AUTHORITY_REGISTRY_NOT_CONFIGURED',
    ],
    ['LIHEN_EDITORIAL_RESEARCH_FREE_ONLY_EVIDENCE_REF', '', 'FREE_ONLY_NOT_CONFIGURED'],
    [
      'LIHEN_EDITORIAL_RESEARCH_FREE_ONLY_VERIFIED_AT',
      'secret-invalid-date',
      'FREE_ONLY_NOT_CONFIGURED',
    ],
  ])(
    'fails closed without disclosing invalid server configuration: %s',
    async (key, value, reason) => {
      const { response, body } = await request({ enabled: 'true', env: { [key]: value } });
      expect(response.status).toBe(200);
      expect(body.readiness.readyForActivation).toBe(false);
      expect(body.readiness.reasons).toContain(reason);
      expect(JSON.stringify(body)).not.toMatch(/secret-|private\.example/);
    },
  );
  it.each(['OWNER', 'ADMIN'])(
    'allows ACTIVE %s without research, provider construction or network',
    async (role) => {
      const { response, body, from } = await request({ role });
      expect(response.status).toBe(200);
      expect(body).toEqual({
        runtime: 'LIHEN_INTELLIGENCE',
        action: 'EDITORIAL_RESEARCH_PREFLIGHT',
        readiness: {
          featureEnabled: false,
          providerConfigured: true,
          allowlistConfigured: true,
          authorityRegistryConfigured: true,
          freeOnlyConfigured: true,
          dependenciesConfigured: true,
          readyForActivation: false,
          reasons: ['FEATURE_DISABLED'],
        },
      });
      expect(from).toHaveBeenCalledExactlyOnceWith('profiles');
      expect(JSON.stringify(body)).not.toMatch(/secret-|private\.example|untrusted|2026-/);
    },
  );
  it('also performs zero research/network when configuration is ready', async () => {
    const { body } = await request({ enabled: 'true' });
    expect(body.readiness.readyForActivation).toBe(true);
    expect(body.readiness.reasons).toEqual([]);
  });
  it('is ready without GROQ_API_KEY and performs zero discovery I/O', async () => {
    const { body } = await request({ enabled: 'true', env: { GROQ_API_KEY: '' } });
    expect(body.readiness.providerConfigured).toBe(true);
    expect(body.readiness.readyForActivation).toBe(true);
    expect(Object.keys(body.readiness).sort()).toEqual(
      [
        'featureEnabled',
        'providerConfigured',
        'allowlistConfigured',
        'authorityRegistryConfigured',
        'freeOnlyConfigured',
        'dependenciesConfigured',
        'readyForActivation',
        'reasons',
      ].sort(),
    );
    expect(JSON.stringify(body)).not.toContain('architecture-reviewed:official-domain-discovery');
  });
  it.each(['STAFF', 'CUSTOMER', '', 'owner'])('rejects role %s', async (role) => {
    expect((await request({ role })).response.status).toBe(403);
  });
  it('rejects inactive users', async () => {
    expect((await request({ status: 'INACTIVE' })).response.status).toBe(403);
  });
  it('rejects invalid authentication', async () => {
    expect((await request({ user: false })).response.status).toBe(401);
    expect((await request({ token: '' })).response.status).toBe(401);
  });
  it('keeps pure evaluation isolated from concrete providers and runtime effects', () => {
    const source = readFileSync(
      resolve(
        root,
        'supabase/functions/intelligence-runtime/providers/editorial-research-readiness.ts',
      ),
      'utf8',
    );
    expect(source).toContain('import type { EditorialResearchSearchConfig }');
    expect(source).not.toMatch(
      /\bfetch\s*\(|create\w*Port\s*\(|Deno\.|Date\.now|researchEditorialProduct\s*\(/,
    );
    const runtime = readFileSync(entry, 'utf8');
    const start = runtime.indexOf("if (action === 'EDITORIAL_RESEARCH_PREFLIGHT')");
    expect(start).toBeGreaterThan(
      runtime.indexOf("['OWNER', 'ADMIN'].includes(profile.role_code)"),
    );
    const branch = runtime.slice(
      start,
      runtime.indexOf("if (action === 'EDITORIAL_RESEARCH')", start),
    );
    expect(branch).not.toMatch(
      /await|fetch|createEditorialResearchRuntimeDependencies|researchEditorialProduct|readAssistantProductContext/,
    );
  });
});
