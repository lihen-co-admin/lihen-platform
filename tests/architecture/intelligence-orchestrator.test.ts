import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const source = () =>
  readFileSync(
    join(root, 'packages/intelligence-core/src/orchestrator.ts'),
    'utf8',
  );

describe('Intelligence Orchestrator architecture — GAP-006', () => {
  it('stays independent from apps, UI, Supabase, database and provider SDKs', () => {
    const value = source();

    expect(value).not.toMatch(/react|@supabase\/|@lihen\/database|apps\/control-center/);
    expect(value).not.toMatch(/openai|anthropic|gemini|googleapis|axios|fetch\s*\(/i);
  });

  it('does not expose direct mutation, SQL, RPC or controlled-command execution', () => {
    const value = source();

    expect(value).not.toMatch(/\.rpc\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(/);
    expect(value).not.toMatch(/\bSELECT\b|\bUPDATE\b|\bINSERT\b|\bDELETE FROM\b/i);
    expect(value).not.toMatch(/executeControlledCommand|confirmControlCenterOperation/);
  });

  it('reuses the GAP-004 permission evaluator instead of creating a second permission engine', () => {
    const value = source();

    expect(value).toContain('evaluatePermission');
    expect(value).toContain('INTELLIGENCE_PERMISSION');
    expect(value).not.toContain('function evaluateOrchestratorPermission');
  });

  it('keeps provider/tool abstraction out of GAP-006', () => {
    const value = source();

    expect(value).not.toMatch(/SearchPort|VisionPort|ImageGenerationPort|EmbeddingPort|DocumentExtractionPort/);
  });

  it('keeps future capability composition declarative instead of hardcoding UI routes or social APIs', () => {
    const value = source();

    expect(value).not.toMatch(/instagram|facebook|tiktok|youtube|\/products|\/brands|\/catalogs/i);
  });
});
