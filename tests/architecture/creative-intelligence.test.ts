import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('WAVE 11 / GAP-035 Creative Intelligence architecture', () => {
  const capability = read(
    'packages/intelligence-core/src/capabilities/creative-intelligence.ts',
  );
  const index = read('packages/intelligence-core/src/index.ts');

  it('exports Creative Intelligence from intelligence-core', () => {
    expect(index).toContain(
      "export * from './capabilities/creative-intelligence';",
    );
  });

  it('reuses the provider-neutral ImageGenerationPort and Orchestrator handler contract', () => {
    expect(capability).toContain('ImageGenerationPort');
    expect(capability).toContain('IntelligenceCapabilityHandler');
    expect(capability).toContain("capability: 'CREATIVE_INTELLIGENCE'");
  });

  it('marks generated evidence and candidates with GENERATED provenance', () => {
    expect(capability).toContain("level: 'GENERATED'");
    expect(capability).toContain("provenance: 'GENERATED'");
    expect(capability).toContain("status: 'PENDING'");
  });

  it('does not persist, publish or mutate canonical assets', () => {
    expect(capability).not.toMatch(
      /@supabase|createClient\(|getBrowserSupabaseClient|\.from\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(/i,
    );
    expect(capability).not.toMatch(
      /publishAsset|publishCatalog|setCanonical|replaceCanonical|confirmOperation\(/i,
    );
  });

  it('does not hardcode an image provider or browser credential', () => {
    expect(capability).not.toMatch(
      /from\s+['"]openai['"]|from\s+['"]@anthropic|from\s+['"]@google|apiKey|OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY/i,
    );
  });

  it('keeps generated output reviewable instead of authoritative', () => {
    expect(capability).toContain('requires human review');
    expect(capability).toContain('GENERATED provenance is not canonical business authority');
    expect(capability).toContain('Confidence does not grant permission');
  });
});
