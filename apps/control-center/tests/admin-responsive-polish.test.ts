import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appCss = readFileSync(
  new URL('../src/styles/app.css', import.meta.url),
  'utf8',
);
const tokensCss = readFileSync(
  new URL('../src/styles/tokens.css', import.meta.url),
  'utf8',
);

describe('Control Center responsive polish contract', () => {
  it('provides a visible keyboard focus treatment', () => {
    expect(appCss).toContain(':focus-visible');
    expect(appCss).toContain('outline-offset: 3px');
    expect(tokensCss).toContain('--focus-ring:');
  });

  it('keeps interactive controls at a touch-friendly minimum size', () => {
    expect(tokensCss).toContain('--tap-target: 44px');
    expect(appCss).toContain('min-height: var(--tap-target, 44px)');
  });

  it('contains explicit mobile layout protection', () => {
    expect(appCss).toContain('@media (max-width: 760px)');
    expect(appCss).toContain('@media (max-width: 520px)');
    expect(appCss).toContain('grid-template-columns: 1fr');
  });

  it('protects wide tables from breaking the page layout', () => {
    expect(appCss).toContain('.table-scroll');
    expect(appCss).toContain('overscroll-behavior-inline: contain');
    expect(appCss).toContain('overflow-wrap: anywhere');
  });

  it('respects reduced-motion preferences', () => {
    expect(appCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(appCss).toContain('transition-duration: 0.01ms !important');
  });

  it('keeps a forced-colors focus fallback for accessibility', () => {
    expect(appCss).toContain('@media (forced-colors: active)');
    expect(appCss).toContain('outline: 2px solid CanvasText');
  });
});
