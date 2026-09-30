import { describe, expect, it } from 'vitest';

import { parseEditorialAuthorityRegistry } from '../../../../supabase/functions/intelligence-runtime/providers/editorial-authority-registry';

const valid = {
  domain: 'Brand.Example',
  brandId: 'brand-a',
  brand: 'Marca A',
  role: 'OFFICIAL_BRAND',
  verification: {
    evidenceRef: 'registry:domain-ownership:test',
    reason: 'Synthetic test-only authority record',
    verifiedAt: '2026-09-01T00:00:00.000Z',
    expiresAt: '2026-10-01T00:00:00.000Z',
  },
} as const;

describe('Editorial authority registry', () => {
  it('is empty when configuration is absent', () => {
    expect(parseEditorialAuthorityRegistry(undefined)).toEqual([]);
    expect(parseEditorialAuthorityRegistry('')).toEqual([]);
  });

  it('parses an explicit valid server-side authority record', () => {
    expect(parseEditorialAuthorityRegistry(JSON.stringify([valid]))).toEqual([
      {
        ...valid,
        domain: 'brand.example',
      },
    ]);
  });

  it.each([
    '{',
    '{}',
    JSON.stringify([{ ...valid, domain: '' }]),
    JSON.stringify([{ ...valid, brandId: '' }]),
    JSON.stringify([{ ...valid, role: 'UNKNOWN' }]),
    JSON.stringify([
      {
        ...valid,
        verification: { ...valid.verification, evidenceRef: '' },
      },
    ]),
    JSON.stringify([
      {
        ...valid,
        verification: { ...valid.verification, verifiedAt: 'not-a-date' },
      },
    ]),
    JSON.stringify([
      {
        ...valid,
        verification: {
          ...valid.verification,
          verifiedAt: '2026-11-01T00:00:00.000Z',
          expiresAt: '2026-10-01T00:00:00.000Z',
        },
      },
    ]),
  ])('fails closed for malformed registry configuration', (raw) => {
    expect(parseEditorialAuthorityRegistry(raw)).toEqual([]);
  });

  it('fails closed for the whole registry when one record is malformed', () => {
    expect(
      parseEditorialAuthorityRegistry(JSON.stringify([valid, { ...valid, domain: '' }])),
    ).toEqual([]);
  });

  it('rejects ambiguous duplicate domain/brand authority records', () => {
    expect(
      parseEditorialAuthorityRegistry(
        JSON.stringify([valid, { ...valid, role: 'SECONDARY_REFERENCE' }]),
      ),
    ).toEqual([]);
  });
});
