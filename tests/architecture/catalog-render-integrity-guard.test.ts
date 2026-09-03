import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rendererPath = path.join(
  root,
  'apps/control-center/src/pages/CatalogPdfRenderPage.tsx',
);
const guardPath = path.join(
  root,
  'apps/control-center/src/read-models/catalog-render-integrity.ts',
);

describe('GAP-025 Render Integrity Guard architecture', () => {
  it('formalizes render integrity outside the React renderer', () => {
    const renderer = fs.readFileSync(rendererPath, 'utf8');
    const guard = fs.readFileSync(guardPath, 'utf8');

    expect(renderer).toContain('evaluateCatalogRenderIntegrity');
    expect(renderer).toContain('renderIntegrity.canPrint');
    expect(renderer).not.toContain('const canPrint =');
    expect(guard).toContain('BLOCKED_ASSET_FAILURE');
    expect(guard).toContain('BLOCKED_PENDING_ASSETS');
  });

  it('keeps the guard pure and free of infrastructure/runtime side effects', () => {
    const guard = fs.readFileSync(guardPath, 'utf8');

    expect(guard).not.toMatch(/from ['"]react['"]/);
    expect(guard).not.toMatch(/@supabase|@lihen\/database/);
    expect(guard).not.toContain('.rpc(');
    expect(guard).not.toContain('window.print');
  });

  it('preserves explicit print blocking at the renderer boundary', () => {
    const renderer = fs.readFileSync(rendererPath, 'utf8');

    expect(renderer).toContain('disabled={!renderIntegrity.canPrint}');
    expect(renderer).toContain('onClick={() => window.print()}');
    expect(renderer).toContain('renderIntegrity.hasFailures');
  });

  it('does not absorb STYLE editorial policy or PDF composition responsibilities', () => {
    const guard = fs.readFileSync(guardPath, 'utf8');

    expect(guard).not.toContain('buildStyleBodyPages');
    expect(guard).not.toContain('composeCatalogRenderModel');
    expect(guard).not.toContain('selectedPdfAsset');
  });
});
