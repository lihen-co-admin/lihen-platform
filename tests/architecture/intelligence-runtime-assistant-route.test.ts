import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

const runtime = readFileSync(
  resolve(root, 'supabase/functions/intelligence-runtime/index.ts'),
  'utf8',
);

describe('Intelligence Runtime Assistant route architecture', () => {
  const start = runtime.indexOf("if (action === 'ASSISTANT')");
  const end = runtime.indexOf("if (action === 'PROMOTE_CATALOG_PDF')");
  const route = runtime.slice(start, end);

  it('keeps the governed ASSISTANT route', () => {
    expect(start).toBeGreaterThan(-1);
    expect(start).toBeLessThan(end);
    expect(route).toContain('runLihenAssistantTurn(');
    expect(route).toContain("source: 'ProductMaster:GetProductById'");
  });

  it('reads Product Master with the authenticated user client', () => {
    expect(route).toMatch(
      /readAssistantProductContext\(\s*supabase,\s*requestedProductId,\s*\)/,
    );
    expect(route).not.toMatch(
      /readAssistantProductContext\(\s*serviceSupabase/,
    );
  });

  it('keeps the Intelligence principal least-privilege', () => {
    expect(route).toContain('INTELLIGENCE_PERMISSION.READ_CONTEXT');
    expect(route).toContain('INTELLIGENCE_PERMISSION.ANALYZE');
    expect(route).not.toContain('INTELLIGENCE_PERMISSION.GENERATE');
    expect(route).not.toContain('MUTATE_MASTER');
    expect(route).not.toContain('POST_FINANCE');
    expect(route).not.toContain('PUBLISH');
  });

  it('configures Groq only from a server-side secret', () => {
    expect(runtime).toContain("from './providers/groq-model.ts'");
    expect(route).toContain("Deno.env.get('GROQ_API_KEY')");
    expect(route).toContain('model: createGroqModelPort({');
    expect(route).not.toContain('VITE_GROQ_API_KEY');
  });

  it('keeps provider optional when GROQ_API_KEY is absent', () => {
    expect(route).toContain("Deno.env.get('GROQ_API_KEY')?.trim()");
    expect(route).toContain(': {})');
  });

  it('does not add write authority to Assistant', () => {
    expect(route).not.toContain('serviceSupabase');
    expect(route).not.toContain('.insert(');
    expect(route).not.toContain('.update(');
    expect(route).not.toContain('.delete(');
  });
});
