import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const source = () =>
  readFileSync(
    join(root, 'packages/intelligence-core/src/provider-ports.ts'),
    'utf8',
  );

describe('Provider & Tool Abstraction architecture — GAP-007', () => {
  it('is provider-neutral and has no vendor SDK imports', () => {
    const value = source();

    expect(value).not.toMatch(/openai|anthropic|gemini|vertex|azure|aws|bedrock/i);
    expect(value).not.toMatch(/@google|@aws|axios|fetch\s*\(/i);
  });

  it('has no app, React, Supabase or database dependency', () => {
    const value = source();

    expect(value).not.toMatch(/react|@supabase\/|@lihen\/database|apps\/control-center/);
  });

  it('does not expose mutation, RPC, publishing or controlled command execution', () => {
    const value = source();

    expect(value).not.toMatch(/\.rpc\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(/);
    expect(value).not.toMatch(/executeControlledCommand|publishCatalog|postFinance/i);
  });

  it('defines the six GAP-007 provider/tool boundaries', () => {
    const value = source();

    for (const contract of [
      'ModelPort',
      'VisionPort',
      'SearchPort',
      'DocumentExtractionPort',
      'ImageGenerationPort',
      'EmbeddingPort',
    ]) {
      expect(value).toContain(`interface ${contract}`);
    }
  });

  it('does not turn future Social publishing into an Intelligence provider port', () => {
    const value = source();

    expect(value).not.toContain('SocialPublishingPort');
    expect(value).not.toMatch(/instagram|facebook|tiktok|youtube/i);
  });
});
