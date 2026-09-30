import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

const runtime = readFileSync(
  resolve(root, 'supabase/functions/intelligence-runtime/index.ts'),
  'utf8',
);

const expectedActions = [
  'EDITORIAL_RESEARCH',
  'DOCUMENT_EXTRACTION',
  'ASSISTANT',
  'LIST_STYLE_CATALOG_PDF_APPROVED_UNPROMOTED',
  'PREPARE_STYLE_CATALOG_PDF_BROWSER_PROMOTION',
  'FINALIZE_STYLE_CATALOG_PDF_BROWSER_PROMOTION',
  'PROMOTE_STYLE_CATALOG_PDF_BATCH',
  'PROMOTE_CATALOG_PDF',
  'LIST_STYLE_CATALOG_PDF_PENDING_REVIEWS',
  'GET_CATALOG_PDF_REVIEW_ACCESS',
  'REGISTER_STYLE_CATEGORY_COVERS',
] as const;

function actionMarker(action: string) {
  return `if (action === '${action}')`;
}

describe('intelligence runtime route coexistence', () => {
  it('preserves every governed runtime action exactly once', () => {
    for (const action of expectedActions) {
      const marker = actionMarker(action);
      const occurrences = runtime.split(marker).length - 1;

      expect(
        occurrences,
        `${action} should exist exactly once`,
      ).toBe(1);
    }
  });

  it('preserves the reconciled route ordering', () => {
    const positions = expectedActions.map((action) => ({
      action,
      position: runtime.indexOf(actionMarker(action)),
    }));

    for (const entry of positions) {
      expect(
        entry.position,
        `${entry.action} should exist`,
      ).toBeGreaterThanOrEqual(0);
    }

    for (let index = 1; index < positions.length; index += 1) {
      expect(
        positions[index].position,
        `${positions[index].action} should follow ${positions[index - 1].action}`,
      ).toBeGreaterThan(positions[index - 1].position);
    }
  });

  it('keeps Editorial Research explicitly opt-in', () => {
    expect(runtime).toMatch(
      /LIHEN_EDITORIAL_RESEARCH_ENABLED'\)\?\.trim\(\)\s*===\s*'true'/,
    );
  });

  it('keeps document extraction wired to its edge bundle', () => {
    expect(runtime).toContain(
      "from './document-extraction-edge.mjs'",
    );
    expect(runtime).toContain(
      "if (action === 'DOCUMENT_EXTRACTION')",
    );
  });
});
