import { buildCatalogHref } from './catalog-navigation';
import { getStorefrontProducts } from './storefront-api';
import { renderProductCard } from './product-card';
import { bindProductInteractions } from './product-interactions';
import { openProductDetail } from './product-detail';
import { carouselArrowIcon } from './carousel-navigation';

interface RailConfig {
  root: HTMLElement;
  target: string;
  title: string;
  eyebrow: string;
  query: Parameters<typeof getStorefrontProducts>[0];
}

async function hydrateRail(config: RailConfig): Promise<void> {
  const host = config.root.querySelector<HTMLElement>(config.target);
  if (!host) return;

  try {
    const page = await getStorefrontProducts({ ...config.query, limit: 10 });
    if (page.items.length === 0) {
      host.hidden = true;
      return;
    }
    host.innerHTML = `
      <div class="product-rail__heading">
        <div><p class="lihen-eyebrow">${config.eyebrow}</p><h2 class="lihen-display">${config.title}</h2></div>
        <div class="product-rail__heading-actions">
          <a href="${buildCatalogHref({ businessLine: config.query?.businessLine as 'BEAUTY_CARE' | 'STYLE' | undefined, brand: config.query?.brand })}">Ver catálogo</a>
          <div class="product-rail__controls" aria-label="Mover productos">
            <button class="lihen-carousel-button" type="button" data-rail-prev aria-label="Ver productos anteriores">${carouselArrowIcon('previous')}</button>
            <button class="lihen-carousel-button" type="button" data-rail-next aria-label="Ver más productos">${carouselArrowIcon('next')}</button>
          </div>
        </div>
      </div>
      <div class="product-rail__viewport" tabindex="0">
        <div class="product-rail__track">${page.items.map((product, index) => renderProductCard(product, index < 2)).join('')}</div>
      </div>
    `;
    bindProductInteractions(host, page.items, openProductDetail);

    const viewport = host.querySelector<HTMLElement>('.product-rail__viewport');
    const prev = host.querySelector<HTMLButtonElement>('[data-rail-prev]');
    const next = host.querySelector<HTMLButtonElement>('[data-rail-next]');
    if (viewport && prev && next) {
      const updateNavigation = (): void => {
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const canScroll = maxScroll > 4;
        prev.disabled = !canScroll || viewport.scrollLeft <= 4;
        next.disabled = !canScroll || viewport.scrollLeft >= maxScroll - 4;
      };
      const step = (): number => Math.max(220, viewport.clientWidth * .78);
      prev.addEventListener('click', () => viewport.scrollBy({ left: -step(), behavior: 'smooth' }));
      next.addEventListener('click', () => viewport.scrollBy({ left: step(), behavior: 'smooth' }));
      viewport.addEventListener('scroll', updateNavigation, { passive: true });
      window.addEventListener('resize', updateNavigation);
      requestAnimationFrame(updateNavigation);
    }
  } catch (error) {
    host.innerHTML = `<p class="product-rail__error">${error instanceof Error ? error.message : 'No fue posible cargar productos.'}</p>`;
  }
}

export async function hydrateHomeProductRails(root: HTMLElement): Promise<void> {
  await Promise.all([
    hydrateRail({
      root,
      target: '[data-product-rail="discover"]',
      title: 'Descubre productos del catálogo.',
      eyebrow: 'Selección LIHEN',
      query: { businessLine: 'BEAUTY_CARE' },
    }),
    hydrateRail({
      root,
      target: '[data-product-rail="bloomshell"]',
      title: 'Favoritos de Bloomshell.',
      eyebrow: 'Compra por marca',
      query: { businessLine: 'BEAUTY_CARE', brand: 'Bloomshell' },
    }),
  ]);
}
