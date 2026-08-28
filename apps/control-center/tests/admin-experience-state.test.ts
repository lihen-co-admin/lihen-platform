import { describe, expect, it } from 'vitest';
import {
  formatOperationalFocusLabel,
  resolveAdminExperienceState,
} from '../src/domain/admin-experience-state';

describe('resolveAdminExperienceState', () => {
  it('prioritizes an error over loading and exposes assertive semantics', () => {
    const result = resolveAdminExperienceState({
      isLoading: true,
      errorMessage: 'Fallo de lectura',
      hasData: false,
    });

    expect(result.state).toBe('ERROR');
    expect(result.role).toBe('alert');
    expect(result.ariaLive).toBe('assertive');
    expect(result.ariaBusy).toBe(false);
  });

  it('returns an accessible loading state while data is pending', () => {
    const result = resolveAdminExperienceState({
      isLoading: true,
      errorMessage: '',
      hasData: false,
    });

    expect(result.state).toBe('LOADING');
    expect(result.role).toBe('status');
    expect(result.ariaLive).toBe('polite');
    expect(result.ariaBusy).toBe(true);
  });

  it('returns EMPTY when loading ended without data or error', () => {
    const result = resolveAdminExperienceState({
      isLoading: false,
      errorMessage: '',
      hasData: false,
    });

    expect(result.state).toBe('EMPTY');
    expect(result.ariaBusy).toBe(false);
  });

  it('returns READY when data is available', () => {
    const result = resolveAdminExperienceState({
      isLoading: false,
      errorMessage: '',
      hasData: true,
    });

    expect(result.state).toBe('READY');
    expect(result.role).toBeUndefined();
  });
});

describe('formatOperationalFocusLabel', () => {
  it('converts technical focus enums into admin-facing Spanish labels', () => {
    expect(formatOperationalFocusLabel('INTEGRITY')).toBe('Integridad');
    expect(formatOperationalFocusLabel('HUMAN_DECISION')).toBe('Decisión humana');
    expect(formatOperationalFocusLabel('INTELLIGENCE_ASSURANCE')).toBe(
      'Revisión de Intelligence',
    );
  });

  it('keeps ordinary operational focuses concise', () => {
    expect(formatOperationalFocusLabel('ORDERS')).toBe('Pedidos');
    expect(formatOperationalFocusLabel('PURCHASES')).toBe('Compras');
    expect(formatOperationalFocusLabel('INVENTORY')).toBe('Inventario');
    expect(formatOperationalFocusLabel('MONITOR')).toBe('Monitoreo');
  });
});
