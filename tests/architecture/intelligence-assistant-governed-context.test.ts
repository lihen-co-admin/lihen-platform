import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

const assistant = readFileSync(
  resolve(
    root,
    'packages/intelligence-core/src/assistant.ts',
  ),
  'utf8',
);

describe('LIHEN Assistant governed model context', () => {
  it('includes governed execution context in model messages', () => {
    expect(assistant).toContain(
      "context: IntelligenceCapabilityExecutionInput['context']",
    );
    expect(assistant).toContain(
      'const governedContext = JSON.stringify(',
    );
    expect(assistant).toContain(
      "'GOVERNED_CONTEXT:'",
    );
  });

  it('passes input.context to modelMessages', () => {
    expect(assistant).toContain(
      'messages: modelMessages(',
    );
    expect(assistant).toContain(
      'input.context,',
    );
    expect(assistant).not.toContain(
      'messages: modelMessages(prompt),',
    );
  });

  it('makes a valid Assistant answer observable to orchestration', () => {
    expect(assistant).toContain(
      "'Assistant answer generated from governed context.'",
    );
  });

  it('preserves the no-write policy', () => {
    expect(assistant).toContain(
      'Do not claim authority to mutate master data',
    );
    expect(assistant).toContain(
      'change inventory or execute controlled operations.',
    );
  });
});
