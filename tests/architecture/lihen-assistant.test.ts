import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('WAVE 10 / GAP-034 LIHEN Assistant architecture', () => {
  const assistant = read('packages/intelligence-core/src/assistant.ts');
  const page = read('apps/control-center/src/pages/AssistantPage.tsx');
  const app = read('apps/control-center/src/app/App.tsx');
  const shell = read('apps/control-center/src/components/AppShell.tsx');
  const index = read('packages/intelligence-core/src/index.ts');

  it('exports the Assistant facade and reuses Context Resolver + Orchestrator', () => {
    expect(index).toContain("export * from './assistant';");
    expect(assistant).toContain('resolveAssistantContext');
    expect(assistant).toContain('orchestrateIntelligenceRequest');
    expect(assistant).toContain("requestedCapabilities: ['ASSISTANT']");
  });

  it('uses provider-neutral ModelPort instead of hardcoding a model vendor', () => {
    expect(assistant).toContain('ModelPort');
    expect(assistant).not.toMatch(
      /from\s+['"]openai['"]|from\s+['"]@anthropic|from\s+['"]@google\/generative-ai|apiKey|OPENAI_API_KEY|ANTHROPIC_API_KEY/i,
    );
  });

  it('reuses the existing Control Plane human-decision path', () => {
    expect(assistant).toContain('prepareApprovedRecommendationForControlPlane');
    expect(assistant).not.toContain('confirmPreparedControlPlaneIntent(');
  });

  it('adds one protected conversational route in the existing Control Center', () => {
    expect(app).toContain("import { AssistantPage } from '../pages/AssistantPage';");
    expect(app).toContain('<Route path="/assistant" element={<AssistantPage />} />');
    expect(shell).toContain("{ to: '/assistant', label: 'Assistant', icon: '✧' }");
  });

  it('keeps browser UI free from provider SDKs, secrets and direct mutations', () => {
    expect(page).not.toMatch(
      /openai|anthropic|generative-ai|api[_-]?key|service_role|supabaseKey/i,
    );
    expect(page).not.toMatch(
      /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/,
    );
  });

  it('states the no-autonomous-mutation boundary in the conversational UI', () => {
    expect(page).toContain('El Assistant no tiene autoridad de escritura');
    expect(page).toContain('No se realizó ninguna');
  });
});
