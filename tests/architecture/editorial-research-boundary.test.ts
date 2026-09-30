import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROVIDER_CAPABILITY_MATRIX } from '../../packages/intelligence-core/src/provider-capability-matrix';

const read = (path: string) => readFileSync(path, 'utf8');
describe('EDITORIAL-RESEARCH-01 remains local and provider-independent', () => {
  it('does not claim activation of SEARCH or remove the existing Brand Intelligence dependencies', () => {
    expect(PROVIDER_CAPABILITY_MATRIX.SEARCH.implementation).toBe('ABSTRACT_ONLY');
    expect(PROVIDER_CAPABILITY_MATRIX.BRAND_INTELLIGENCE.requiredPorts).toContain('SearchPort');
  });
  it('has no networking, persistence, SDK, secret or external execution in the research boundary', () => {
    for (const path of [
      'packages/intelligence-core/src/capabilities/editorial-research.ts',
      'apps/control-center/src/composition/editorial-research.ts',
    ]) {
      const source = read(path);
      expect(source).not.toMatch(
        /\bfetch\s*\(|axios|Deno\.env|process\.env|API_KEY|\.rpc\s*\(|\.invoke\s*\(|\.insert\s*\(|\.update\s*\(|\.upsert\s*\(/,
      );
      expect(source).not.toMatch(
        /graph\.facebook|tiktok\.com|whatsapp|marketing-social-runtime|scheduler/i,
      );
    }
  });
  it('keeps provider policy server-side behind the dedicated editorial research runtime action', () => {
    const local = read('apps/control-center/src/composition/editorial-research.ts');
    expect(local).not.toMatch(/^\s*(search|freeOnly|authorities)\s*:/m);

    const runtime = read('supabase/functions/intelligence-runtime/index.ts');
    expect(runtime).toMatch(/EDITORIAL_RESEARCH/);
    expect(runtime).toMatch(/researchEditorialProduct/);
    expect(runtime).toMatch(/createEditorialResearchRuntimeDependencies/);
  });
});
