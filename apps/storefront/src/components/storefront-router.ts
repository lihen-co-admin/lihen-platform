import { bindHomePageInteractions, renderHomePage } from './home-page';

type Route = 'home' | 'catalog';
let activeRoute: Route | null = null;

function routeFromHash(): Route {
  return location.hash.startsWith('#catalogo') ? 'catalog' : 'home';
}

export async function renderCurrentRoute(root: HTMLElement, force = false): Promise<void> {
  const main = root.querySelector<HTMLElement>('#contenido');
  if (!main) return;
  const route = routeFromHash();
  if (!force && activeRoute === route) return;
  activeRoute = route;

  if (route === 'catalog') {
    const { renderCatalogPage, bindCatalogPage } = await import('./catalog-page');
    main.innerHTML = renderCatalogPage();
    await bindCatalogPage(main);
    document.title = 'Catálogo | LIHEN.CO';
    main.focus({ preventScroll: true });
    return;
  }

  main.innerHTML = renderHomePage();
  bindHomePageInteractions(main);
  const { hydrateHomeProductRails } = await import('./home-product-rails');
  void hydrateHomeProductRails(main);
  document.title = 'LIHEN.CO | Beauty Care & Style';
}

export function bindStorefrontRouter(root: HTMLElement): void {
  window.addEventListener('hashchange', () => {
    void renderCurrentRoute(root);
  });
}
