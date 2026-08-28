export interface ProductGalleryState {
  readonly index: number;
  readonly counter: string;
  readonly previousDisabled: boolean;
  readonly nextDisabled: boolean;
}

export function resolveProductGalleryState(
  targetIndex: number,
  imageCount: number,
): ProductGalleryState {
  const safeCount = Math.max(0, Math.floor(imageCount));

  if (safeCount === 0) {
    return {
      index: 0,
      counter: '0 / 0',
      previousDisabled: true,
      nextDisabled: true,
    };
  }

  const safeTarget = Number.isFinite(targetIndex) ? Math.floor(targetIndex) : 0;
  const index = Math.min(Math.max(safeTarget, 0), safeCount - 1);

  return {
    index,
    counter: `${index + 1} / ${safeCount}`,
    previousDisabled: index <= 0,
    nextDisabled: index >= safeCount - 1,
  };
}

export function shouldHandleProductGalleryKey(key: string): boolean {
  return key === 'ArrowLeft' || key === 'ArrowRight';
}
