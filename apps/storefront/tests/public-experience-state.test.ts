import { describe, expect, it, vi } from 'vitest';
import {
  publicScrollBehavior,
  resolvePublicExperienceState,
} from '../src/components/public-experience-state';

describe('resolvePublicExperienceState', () => {
  it('prioritizes ERROR over loading or item count', () => {
    const result = resolvePublicExperienceState({
      isLoading: true,
      itemCount: 4,
      errorMessage: 'No fue posible cargar el catálogo.',
      emptyMessage: 'Vacío',
      readyMessage: 'Listo',
    });

    expect(result.state).toBe('ERROR');
    expect(result.role).toBe('alert');
    expect(result.ariaLive).toBe('assertive');
    expect(result.ariaBusy).toBe(false);
  });

  it('returns an accessible LOADING state', () => {
    const result = resolvePublicExperienceState({
      isLoading: true,
      itemCount: 0,
      emptyMessage: 'Vacío',
      readyMessage: 'Listo',
    });

    expect(result.state).toBe('LOADING');
    expect(result.role).toBe('status');
    expect(result.ariaBusy).toBe(true);
  });

  it('returns EMPTY when loading finishes without products', () => {
    const result = resolvePublicExperienceState({
      isLoading: false,
      itemCount: 0,
      emptyMessage: 'No encontramos productos.',
      readyMessage: 'Listo',
    });

    expect(result.state).toBe('EMPTY');
    expect(result.message).toBe('No encontramos productos.');
  });

  it('returns READY when products exist', () => {
    const result = resolvePublicExperienceState({
      isLoading: false,
      itemCount: 2,
      emptyMessage: 'Vacío',
      readyMessage: '2 productos mostrados.',
    });

    expect(result.state).toBe('READY');
    expect(result.message).toBe('2 productos mostrados.');
  });
});

describe('publicScrollBehavior', () => {
  it('uses auto when the visitor prefers reduced motion', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    });

    expect(publicScrollBehavior()).toBe('auto');
    vi.unstubAllGlobals();
  });

  it('uses smooth when reduced motion is not requested', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    });

    expect(publicScrollBehavior()).toBe('smooth');
    vi.unstubAllGlobals();
  });
});
