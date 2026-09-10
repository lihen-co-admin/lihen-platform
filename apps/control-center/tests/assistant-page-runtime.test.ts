import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

const page = readFileSync(
  resolve(
    root,
    'control-center/src/pages/AssistantPage.tsx',
  ),
  'utf8',
);

describe('AssistantPage trusted runtime wiring', () => {
  it('uses the Edge runtime adapter instead of local Assistant execution', () => {
    expect(page).toContain(
      "import { assistantRuntimeInvoker } from '../composition/assistant-runtime';",
    );

    expect(page).toContain(
      'assistantRuntimeInvoker.invokeProductTurn({',
    );

    expect(page).not.toContain(
      "import { assistantComposition } from '../composition/assistant';",
    );

    expect(page).not.toContain(
      'assistantComposition.runProductTurn(',
    );
  });

  it('sends only prompt and productId to the runtime adapter', () => {
    const invocationStart =
      page.indexOf(
        'assistantRuntimeInvoker.invokeProductTurn({',
      );

    expect(invocationStart).toBeGreaterThan(-1);

    const invocationEnd =
      page.indexOf('});', invocationStart);

    const invocation =
      page.slice(invocationStart, invocationEnd);

    expect(invocation).toContain('prompt,');
    expect(invocation).toContain('productId,');

    expect(invocation).not.toContain('requestedBy');
    expect(invocation).not.toContain('authorized');
    expect(invocation).not.toContain('context');
    expect(invocation).not.toContain('product:');
  });

  it('keeps the local authorization UX precondition', () => {
    expect(page).toContain(
      'if (!auth.authorized || !auth.user)',
    );

    expect(page).toContain(
      "setUiState('PERMISSION_DENIED')",
    );
  });

  it('fails closed when Edge invocation throws', () => {
    expect(page).toContain('} catch (error) {');
    expect(page).toContain(
      "setUiState('DEPENDENCY_FAILED')",
    );
    expect(page).toContain(
      'LIHEN_ASSISTANT_RUNTIME_UNKNOWN_FAILURE',
    );
  });

  it('preserves the provider-not-configured DEV state', () => {
    expect(page).toContain(
      "case 'PROVIDER_NOT_CONFIGURED':",
    );
    expect(page).toContain(
      "setUiState('PROVIDER_NOT_CONFIGURED')",
    );
  });
});
