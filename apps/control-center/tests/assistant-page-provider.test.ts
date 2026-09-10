import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

const page = readFileSync(
  resolve(root, 'control-center/src/pages/AssistantPage.tsx'),
  'utf8',
);

describe('AssistantPage provider states', () => {
  it('supports SUCCESS and PROVIDER_FAILED', () => {
    expect(page).toContain("| 'SUCCESS'");
    expect(page).toContain("| 'PROVIDER_FAILED'");
    expect(page).toContain("case 'SUCCESS':");
    expect(page).toContain("case 'PROVIDER_FAILED':");
  });

  it('renders the model answer', () => {
    expect(page).toContain('setAnswer(turn.answer ?? null)');
    expect(page).toContain('Respuesta de LIHEN Assistant');
  });

  it('preserves Product Master traceability', () => {
    expect(page).toContain('Contexto resuelto desde');
  });
});
