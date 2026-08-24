import { getStorefrontProducts } from './storefront-api';
import { renderProductCard } from './product-card';
import { bindProductInteractions } from './product-interactions';
import { openProductDetail } from './product-detail';

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
        <a href="#catalogo">Ver catálogo</a>
      </div>
      <div class="product-rail__viewport" tabindex="0">
        <div class="product-rail__track">${page.items.map((product, index) => renderProductCard(product, index < 2)).join('')}</div>
      </div>
    `;
    bindProductInteractions(host, page.items, openProductDetail);
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
