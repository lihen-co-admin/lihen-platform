import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

const runtime = readFileSync(
  resolve(root, 'supabase/functions/intelligence-runtime/index.ts'),
  'utf8',
);

const removeBgProvider = readFileSync(
  resolve(
    root,
    'supabase/functions/intelligence-runtime/providers/remove-bg-image-transformation.ts',
  ),
  'utf8',
);

describe('Intelligence Runtime trusted-boundary architecture', () => {
  it('keeps the HTTP runtime in the Supabase Edge boundary', () => {
    expect(runtime).toContain('Deno.serve(async (req: Request) => {');
    expect(runtime).toContain("req.method === 'OPTIONS'");
    expect(runtime).toContain("req.method !== 'POST'");
    expect(runtime).toContain("'METHOD_NOT_ALLOWED'");
  });

  it('requires an authenticated Bearer principal before governed execution', () => {
    expect(runtime).toContain("req.headers.get('Authorization')");
    expect(runtime).toContain("authorization?.startsWith('Bearer ')");
    expect(runtime).toContain("'LIHEN_AUTH_REQUIRED'");
    expect(runtime).toContain('supabase.auth.getUser(token)');
    expect(runtime).toContain("'LIHEN_AUTH_INVALID'");
  });

  it('fails closed unless the persisted profile is ACTIVE OWNER or ADMIN', () => {
    expect(runtime).toContain(
      ".select('id,role_code,authorization_status')",
    );
    expect(runtime).toContain(
      "profile.authorization_status !== 'ACTIVE'",
    );
    expect(runtime).toContain(
      "['OWNER', 'ADMIN'].includes(profile.role_code)",
    );
    expect(runtime).toContain("'LIHEN_INTELLIGENCE_FORBIDDEN'");
    expect(runtime).toContain(
      "'LIHEN_INTELLIGENCE_ROLE_FORBIDDEN'",
    );
  });

  it('keeps elevated Supabase authority server-side and explicit', () => {
    expect(runtime).toContain(
      "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
    );
    expect(runtime).toContain(
      "'LIHEN_SERVICE_ROLE_NOT_CONFIGURED'",
    );
    expect(runtime).not.toMatch(/VITE_.*SERVICE_ROLE/i);
  });

  it('routes image transformation through Intelligence Core orchestration', () => {
    expect(runtime).toContain(
      'createImageTransformationHandler({',
    );
    expect(runtime).toContain(
      'orchestrateIntelligenceRequest(',
    );
    expect(runtime).toContain(
      "requestedCapabilities: ['IMAGE_TRANSFORMATION']",
    );
    expect(runtime).toContain(
      "'NO_PUBLICATION_OCCURRED'",
    );
  });

  it('keeps the concrete remove.bg credential inside the Edge provider adapter', () => {
    expect(removeBgProvider).toContain(
      "Deno.env.get('REMOVE_BG_API_KEY')",
    );
    expect(removeBgProvider).toContain(
      "'REMOVE_BG_API_KEY_NOT_CONFIGURED'",
    );
    expect(removeBgProvider).toContain(
      "'https://api.remove.bg/v1.0/removebg'",
    );
    expect(removeBgProvider).toContain(
      "'X-Api-Key': apiKey",
    );
    expect(removeBgProvider).not.toMatch(
      /VITE_REMOVE_BG|VITE_.*API_KEY/i,
    );
  });

  it('fails closed on invalid or empty provider input/output', () => {
    expect(removeBgProvider).toContain(
      "'REMOVE_BG_SOURCE_EMPTY'",
    );
    expect(removeBgProvider).toContain(
      'REMOVE_BG_SOURCE_MIME_NOT_ALLOWED',
    );
    expect(removeBgProvider).toContain(
      'REMOVE_BG_PROVIDER_FAILED:',
    );
    expect(removeBgProvider).toContain(
      "'REMOVE_BG_PROVIDER_EMPTY_RESULT'",
    );
  });
});
