import { describe, expect, it } from 'vitest';
import { BrandAsset, BrandAssetSet } from '../src';

const asset = (
  id: string,
  overrides: Partial<ConstructorParameters<typeof BrandAsset>[0]> = {},
) =>
  new BrandAsset({
    id,
    brandId: 'brand-1',
    kind: 'LOGO',
    publicUrl: `https://example.com/${id}.svg`,
    ...overrides,
  });

describe('WAVE 5 / GAP-015 Brand Asset Domain', () => {
  it('supports zero, one or many Brand Assets for one brand', () => {
    expect(new BrandAssetSet('brand-1', []).isEmpty()).toBe(true);
    expect(new BrandAssetSet('brand-1', [asset('asset-1')]).size()).toBe(1);
    expect(
      new BrandAssetSet('brand-1', [asset('asset-1'), asset('asset-2')]).size(),
    ).toBe(2);
  });

  it('enforces ownership and unique asset IDs', () => {
    expect(
      () =>
        new BrandAssetSet('brand-1', [
          asset('asset-1', { brandId: 'brand-2' }),
        ]),
    ).toThrow('same brandId');

    expect(
      () =>
        new BrandAssetSet('brand-1', [
          asset('asset-1'),
          asset('asset-1'),
        ]),
    ).toThrow('Duplicate Brand Asset id');
  });

  it('orders deterministically by sortOrder and id', () => {
    const set = new BrandAssetSet('brand-1', [
      asset('asset-c', { sortOrder: 2 }),
      asset('asset-b', { sortOrder: 1 }),
      asset('asset-a', { sortOrder: 1 }),
    ]);

    expect(set.all().map((item) => item.id)).toEqual([
      'asset-a',
      'asset-b',
      'asset-c',
    ]);
  });

  it('allows at most one ACTIVE primary per kind', () => {
    expect(
      () =>
        new BrandAssetSet('brand-1', [
          asset('asset-1', { isPrimary: true }),
          asset('asset-2', { isPrimary: true }),
        ]),
    ).toThrow('Only one ACTIVE primary Brand Asset');

    expect(
      new BrandAssetSet('brand-1', [
        asset('asset-1', { isPrimary: true }),
        asset('asset-2', { isPrimary: true, status: 'ARCHIVED' }),
      ]).primary('LOGO')?.id,
    ).toBe('asset-1');
  });

  it('keeps kinds, active/archive projections and primary lookup explicit', () => {
    const set = new BrandAssetSet('brand-1', [
      asset('logo', { kind: 'LOGO', isPrimary: true }),
      asset('wordmark', { kind: 'WORDMARK' }),
      asset('lockup', { kind: 'LOCKUP', status: 'ARCHIVED' }),
    ]);

    expect(set.active().map((item) => item.id)).toEqual(['logo', 'wordmark']);
    expect(set.archived().map((item) => item.id)).toEqual(['lockup']);
    expect(set.byKind('WORDMARK').map((item) => item.id)).toEqual(['wordmark']);
    expect(set.primary('LOGO')?.id).toBe('logo');
  });

  it('validates confidence, sha256 and sortOrder without assigning authority', () => {
    expect(() => asset('bad-confidence', { confidence: 1.1 })).toThrow(
      'confidence must be between 0 and 1',
    );
    expect(() => asset('bad-hash', { sha256: 'abc' })).toThrow(
      'sha256 must be a 64-character hexadecimal value',
    );
    expect(() => asset('bad-order', { sortOrder: -1 })).toThrow(
      'sortOrder must be a non-negative integer',
    );

    const verified = asset('manual', {
      approvalMode: 'MANUAL_VERIFIED',
      confidence: 1,
      sha256: 'a'.repeat(64),
    });
    expect(verified.approvalMode).toBe('MANUAL_VERIFIED');
    expect(verified.confidence).toBe(1);
  });
});
