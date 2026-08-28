import { describe, expect, it } from 'vitest';
import {
  resolveProductGalleryState,
  shouldHandleProductGalleryKey,
} from '../src/components/product-gallery-state';

describe('resolveProductGalleryState', () => {
  it('returns an inert state when no images exist', () => {
    expect(resolveProductGalleryState(0, 0)).toEqual({
      index: 0,
      counter: '0 / 0',
      previousDisabled: true,
      nextDisabled: true,
    });
  });

  it('clamps negative indexes to the first image', () => {
    const result = resolveProductGalleryState(-4, 3);

    expect(result.index).toBe(0);
    expect(result.counter).toBe('1 / 3');
    expect(result.previousDisabled).toBe(true);
  });

  it('clamps indexes past the end to the last image', () => {
    const result = resolveProductGalleryState(9, 3);

    expect(result.index).toBe(2);
    expect(result.counter).toBe('3 / 3');
    expect(result.nextDisabled).toBe(true);
  });

  it('preserves a valid middle index', () => {
    const result = resolveProductGalleryState(1, 3);

    expect(result.index).toBe(1);
    expect(result.previousDisabled).toBe(false);
    expect(result.nextDisabled).toBe(false);
  });
});

describe('shouldHandleProductGalleryKey', () => {
  it('accepts horizontal gallery keys only', () => {
    expect(shouldHandleProductGalleryKey('ArrowLeft')).toBe(true);
    expect(shouldHandleProductGalleryKey('ArrowRight')).toBe(true);
  });

  it('does not capture unrelated keyboard input', () => {
    expect(shouldHandleProductGalleryKey('Enter')).toBe(false);
    expect(shouldHandleProductGalleryKey('Tab')).toBe(false);
  });
});
