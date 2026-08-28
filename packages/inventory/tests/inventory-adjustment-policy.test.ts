import { describe, expect, it } from 'vitest';
import { evaluateInventoryAdjustmentPolicy } from '../src';

describe('inventory adjustment policy', () => {
  it('accepts a positive physical count increase', () => {
    const result = evaluateInventoryAdjustmentPolicy({ quantityDelta: 3, reason: 'PHYSICAL_COUNT_INCREASE', notes: null });
    expect(result.allowed).toBe(true);
  });

  it('rejects a physical decrease expressed as a positive delta', () => {
    const result = evaluateInventoryAdjustmentPolicy({ quantityDelta: 2, reason: 'PHYSICAL_COUNT_DECREASE', notes: 'Conteo físico verificado' });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain('El motivo seleccionado requiere una cantidad negativa.');
  });

  it('requires evidence for damage write-off', () => {
    const result = evaluateInventoryAdjustmentPolicy({ quantityDelta: -1, reason: 'DAMAGE_WRITE_OFF', notes: null });
    expect(result.allowed).toBe(false);
    expect(result.evidenceRequired).toBe(true);
  });

  it('accepts a documented manual correction in either direction', () => {
    const result = evaluateInventoryAdjustmentPolicy({ quantityDelta: 1, reason: 'MANUAL_CORRECTION', notes: 'Conteo doble validado en bodega' });
    expect(result.allowed).toBe(true);
  });
});
