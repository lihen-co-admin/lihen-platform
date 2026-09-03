import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(
  root,
  'apps/control-center/src/pages/BrandsPage.tsx',
);
const readModelPath = path.join(
  root,
  'apps/control-center/src/read-models/brand-workspace.ts',
);
const pageSource = fs.readFileSync(pagePath, 'utf8');
const readModelSource = fs.readFileSync(readModelPath, 'utf8');

describe('WAVE 5 / GAP-017 Brand Workspace architecture', () => {
  it('keeps /brands on the existing canonical Brand read path', () => {
    expect(pageSource).toContain('productsComposition.getBrands.execute');
    expect(pageSource).toContain('buildBrandWorkspaceReadModel');
  });

  it('does not query Supabase or RPC directly from React', () => {
    expect(pageSource).not.toMatch(/@supabase\//);
    expect(pageSource).not.toMatch(/@lihen\/database/);
    expect(pageSource).not.toMatch(/\.from\s*\(\s*['"]brands['"]/);
    expect(pageSource).not.toMatch(/\.rpc\s*\(/);
    expect(pageSource).not.toMatch(/createClient\s*\(/);
  });

  it('does not elevate legacy logo_url into Brand Asset canonical truth', () => {
    expect(pageSource).toContain('brands.logo_url');
    expect(pageSource).toContain('no lo eleva a una segunda fuente de verdad');
    expect(readModelSource).not.toContain('logoUrl');
    expect(readModelSource).not.toContain('logo_url');
  });

  it('makes the human-review and Existing Control Plane boundaries explicit', () => {
    expect(readModelSource).toContain('Unified Human Review Queue');
    expect(readModelSource).toContain('Existing Control Plane requerido');
    expect(readModelSource).toContain(
      'canMutateCanonicalIdentityFromPresentation: false',
    );
  });

  it('protects MANUAL_VERIFIED and does not expose fake mutation actions', () => {
    expect(pageSource).toContain('MANUAL_VERIFIED');
    expect(pageSource).not.toMatch(/approveBrandAsset|saveBrandAsset|replaceBrandAsset/);
    expect(pageSource).not.toMatch(/Aprobar identidad|Guardar identidad|Reemplazar identidad/);
  });

  it('documents that persistence and Brand operations are not fabricated by the UI', () => {
    expect(pageSource).toContain(
      'DEV todavía no tiene persistencia Brand Assets 1:N',
    );
    expect(pageSource).toContain(
      'no presenta botones falsos de aprobar, reemplazar o guardar identidad',
    );
  });
});
