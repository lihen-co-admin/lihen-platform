import { describe, expect, it } from 'vitest';
import { previewControlledTaxonomyImport } from '../src/domain/taxonomy-import';

describe('previewControlledTaxonomyImport', () => {
  it('marks approved missing taxonomy as READY_CREATE', () => {
    const result = previewControlledTaxonomyImport([
      { referenceId: 'B1', entityType: 'BRAND', canonicalName: 'Kaba', approved: true },
    ], []);
    expect(result[0]?.status).toBe('READY_CREATE');
  });

  it('never creates duplicate normalized approved names', () => {
    const result = previewControlledTaxonomyImport([
      { referenceId: 'B1', entityType: 'BRAND', canonicalName: 'D\'Luchi', approved: true },
      { referenceId: 'B2', entityType: 'BRAND', canonicalName: 'D Luchi', approved: true },
    ], []);
    expect(result.every((row) => row.status === 'CONFLICT_NORMALIZED_NAME')).toBe(true);
  });
});
