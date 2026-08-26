import { bindHomePageInteractions, renderHomePage } from './home-page';
import { renderStaticContentPage, type StorefrontContentPage } from './static-content-page';

type Route =
  | { kind: 'home' }
  | { kind: 'catalog' }
  | { kind: 'hub' }
  | { kind: 'product'; ref: string }
  | { kind: 'content'; page: StorefrontContentPage };

const contentRouteByHash: Readonly<Record<string, StorefrontContentPage>> = {
  '#regalos': 'gifts',
  '#nosotros': 'about',
  '#terminos': 'terms',
  '#privacidad': 'privacy',
  '#cambios-devoluciones': 'returns',
  '#envios': 'shipping',
  '#pqrs': 'pqrs',
  '#consumidor': 'consumer',
};

let activeRouteKey: string | null = null;

function routeFromHash(): Route {
  if (location.hash.startsWith('#producto/')) {
    return { kind: 'product', ref: decodeURIComponent(location.hash.slice('#producto/'.length).split('?')[0] ?? '') };
  }
  if (location.hash.startsWith('#catalogo')) return { kind: 'catalog' };
  if (location.hash.startsWith('#descubre')) return { kind: 'hub' };
  const contentPage = contentRouteByHash[location.hash];
  if (contentPage) return { kind: 'content', page: contentPage };
  return { kind: 'home' };
}

function routeKey(route: Route): string {
  if (route.kind === 'content') return `${route.kind}:${route.page}`;
  if (route.kind === 'product') return `${route.kind}:${route.ref}`;
  return route.kind;
}

function titleForContentPage(page: StorefrontContentPage): string {
  const titles: Readonly<Record<StorefrontContentPage, string>> = {
    gifts: 'Ideas para regalar',
    about: 'Nosotros',
    terms: 'Términos y condiciones',
    privacy: 'Política de privacidad',
    returns: 'Cambios y devoluciones',
    shipping: 'Política de envíos',
    pqrs: 'PQRS',
    consumer: 'Derechos del consumidor',
  };
  return `${titles[page]} | LIHEN.CO`;
}

export async function renderCurrentRoute(root: HTMLElement, force = false): Promise<void> {
  const main = root.querySelector<HTMLElement>('#contenido');
  if (!main) return;
  const route = routeFromHash();
  const key = routeKey(route);
  if (!force && activeRouteKey === key) return;
  activeRouteKey = key;

  if (route.kind === 'product') {
    const { renderProductPage } = await import('./product-page');
    const product = await renderProductPage(main, route.ref);
    document.title = product ? `${product.product_name} | LIHEN.CO` : 'Producto | LIHEN.CO';
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }

  if (route.kind === 'hub') {
    const { renderPublicHubPage } = await import('./public-hub-page');
    await renderPublicHubPage(main);
    document.title = 'Descubre LIHEN | LIHEN.CO';
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }

  if (route.kind === 'catalog') {
    const { renderCatalogPage, bindCatalogPage } = await import('./catalog-page');
    main.innerHTML = renderCatalogPage();
    await bindCatalogPage(main);
    document.title = 'Catálogo | LIHEN.CO';
    main.focus({ preventScroll: true });
    return;
  }

  if (route.kind === 'content') {
    if (route.page === 'gifts') {
      const { renderGiftsPage, bindGiftsPage } = await import('./gifts-page');
      main.innerHTML = renderGiftsPage();
      await bindGiftsPage(main);
    } else {
      main.innerHTML = renderStaticContentPage(route.page);
    }
    document.title = titleForContentPage(route.page);
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }

  main.innerHTML = renderHomePage();
  bindHomePageInteractions(main);
  const [{ hydrateHomeProductRails }, { hydrateHomeBrands }] = await Promise.all([
    import('./home-product-rails'),
    import('./home-brands'),
  ]);
  void Promise.all([hydrateHomeProductRails(main), hydrateHomeBrands(main)]);
  document.title = 'LIHEN.CO | Beauty Care & Style';
  const anchor = location.hash.replace(/^#/, '').split('?')[0];
  if (anchor && anchor !== 'inicio') {
    requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
  }
}

export function bindStorefrontRouter(root: HTMLElement): void {
  window.addEventListener('hashchange', () => {
    void renderCurrentRoute(root, true);
  });
}
