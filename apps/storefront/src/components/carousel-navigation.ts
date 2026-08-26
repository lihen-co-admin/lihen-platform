export type CarouselDirection = 'previous' | 'next';

export function carouselArrowIcon(direction: CarouselDirection): string {
  const path = direction === 'previous'
    ? 'M14.5 5.5 8 12l6.5 6.5'
    : 'M9.5 5.5 16 12l-6.5 6.5';

  return `
    <svg class="lihen-carousel-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="${path}" />
    </svg>
  `;
}
