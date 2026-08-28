import { describe, expect, it } from 'vitest';
import {
  resolvePublicNavigationState,
  shouldCloseNavigationOnRouteChange,
} from '../src/components/public-navigation-state';

describe('resolvePublicNavigationState', () => {
  it('keeps the mobile menu open and locks body scrolling', () => {
    const result = resolvePublicNavigationState({
      menuOpen: true,
      activeMegaKey: null,
      desktop: false,
    });

    expect(result.menuOpen).toBe(true);
    expect(result.lockBodyScroll).toBe(true);
    expect(result.menuLabel).toBe('Cerrar menú');
  });

  it('forces the menu closed on desktop', () => {
    const result = resolvePublicNavigationState({
      menuOpen: true,
      activeMegaKey: 'beauty',
      desktop: true,
    });

    expect(result.menuOpen).toBe(false);
    expect(result.lockBodyScroll).toBe(false);
    expect(result.activeMegaKey).toBe('beauty');
  });

  it('uses the correct accessible label when closed', () => {
    const result = resolvePublicNavigationState({
      menuOpen: false,
      activeMegaKey: null,
      desktop: false,
    });

    expect(result.menuLabel).toBe('Abrir menú');
  });
});

describe('shouldCloseNavigationOnRouteChange', () => {
  it('closes navigation for storefront hash routes', () => {
    expect(shouldCloseNavigationOnRouteChange('#catalogo')).toBe(true);
    expect(shouldCloseNavigationOnRouteChange('#regalos')).toBe(true);
  });

  it('does not classify unrelated URLs as storefront route changes', () => {
    expect(shouldCloseNavigationOnRouteChange('https://example.com')).toBe(false);
  });

  it('trims whitespace before evaluating the route', () => {
    expect(shouldCloseNavigationOnRouteChange('  #nosotros  ')).toBe(true);
  });
});
