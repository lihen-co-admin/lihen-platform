import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('WAVE 10 / GAP-033 Assistant Context Resolver architecture', () => {
  const resolver = read('packages/intelligence-core/src/context-resolver.ts');
  const index = read('packages/intelligence-core/src/index.ts');

  it('exports the resolver from intelligence-core', () => {
    expect(index).toContain("export * from './context-resolver';");
  });

  it('reuses existing IntelligenceContext and permission contracts', () => {
    expect(resolver).toContain('IntelligenceContext');
    expect(resolver).toContain('PermissionPrincipal');
    expect(resolver).toContain('INTELLIGENCE_PERMISSION.READ_CONTEXT');
    expect(resolver).toContain('evaluatePermission');
  });

  it('supports the master context families without silently expanding GAP-033', () => {
    for (const contextType of [
      'PRODUCT',
      'BRAND',
      'SUPPLIER',
      'CATALOG',
      'INVENTORY',
      'PRICING',
      'PURCHASE',
      'SALE',
      'FINANCE',
      'AUDIT',
    ]) {
      expect(resolver).toContain(`'${contextType}'`);
    }
  });

  it('keeps concrete persistence and provider concerns outside intelligence-core', () => {
    expect(resolver).not.toMatch(
      /@supabase|createClient\(|getBrowserSupabaseClient|\.from\(|\.rpc\(|select\s+.+from|insert\s+into|update\s+.+set|delete\s+from/i,
    );
    expect(resolver).not.toMatch(
      /from\s+['"]react['"]|require\(['"]react['"]\)|from\s+['"]openai['"]|from\s+['"]@anthropic|from\s+['"]@google\/generative-ai|fetch\(|axios\./i,
    );
  });

  it('does not introduce autonomous mutations or publishing into the resolver', () => {
    expect(resolver).not.toMatch(
      /\.insert\(|\.update\(|\.delete\(|\.upsert\(|MUTATE_MASTER|POST_FINANCE|PUBLISH|CHANGE_PRICE/i,
    );
  });

  it('fails closed on missing grants, missing sources and duplicate sources', () => {
    expect(resolver).toContain("'PERMISSION_DENIED'");
    expect(resolver).toContain("'DEPENDENCY_FAILED'");
    expect(resolver).toContain('Missing context source');
    expect(resolver).toContain('Duplicate context sources');
  });
});
