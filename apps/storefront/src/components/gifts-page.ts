import { getStorefrontProducts } from './storefront-api';
import { renderProductCard } from './product-card';
import { bindProductInteractions } from './product-interactions';
import { openProductDetail } from './product-detail';
import type { StorefrontProduct } from './storefront-product';

const GIFT_MAX_PRICE = 30000;
const GIFT_PAGE_SIZE = 24;

type GiftLine = '' | 'BEAUTY_CARE' | 'STYLE';
type GiftPriceBand = '10000' | '20000' | '30000';

export function renderGiftsPage(): string {
  return `
    <section class="gifts-catalog" aria-labelledby="gifts-title">
      <div class="gifts-catalog__hero lihen-shell">
        <p class="lihen-eyebrow">Ideas para regalar</p>
        <h1 class="lihen-display" id="gifts-title">Regalos que se sienten especiales, sin salirte del presupuesto.</h1>
        <p>Descubre productos reales de hasta <strong>$30.000 COP</strong> para regalar. Esta selección sale directamente del catálogo publicado de Beauty Care y Style.</p>
      </div>
      <div class="gifts-catalog__layout lihen-shell">
        <aside class="gifts-filters" aria-label="Filtrar ideas para regalar">
          <div><span class="gifts-filters__label">Línea</span>
            <label><input type="radio" name="gift-line" value="" checked> Todo</label>
            <label><input type="radio" name="gift-line" value="BEAUTY_CARE"> Beauty Care</label>
            <label><input type="radio" name="gift-line" value="STYLE"> Style</label>
          </div>
          <div><span class="gifts-filters__label">Presupuesto</span>
            <label><input type="radio" name="gift-price" value="30000" checked> Hasta $30.000</label>
            <label><input type="radio" name="gift-price" value="20000"> Hasta $20.000</label>
            <label><input type="radio" name="gift-price" value="10000"> Hasta $10.000</label>
          </div>
          <label class="gifts-filters__available"><input type="checkbox" data-gifts-available> Solo disponibles</label>
        </aside>
        <div class="gifts-results">
          <div class="gifts-results__heading"><div><p class="lihen-eyebrow">Selección LIHEN</p><h2>Opciones dentro de tu presupuesto</h2></div><span data-gifts-status aria-live="polite">Cargando…</span></div>
          <div class="catalog-grid gifts-results__grid" data-gifts-grid aria-busy="true"></div>
          <nav class="catalog-pagination" aria-label="Paginación de ideas para regalar" data-gifts-pagination></nav>
        </div>
      </div>
    </section>
  `;
}

export async function bindGiftsPage(root: HTMLElement): Promise<void> {
  const grid = root.querySelector<HTMLElement>('[data-gifts-grid]');
  const status = root.querySelector<HTMLElement>('[data-gifts-status]');
  const pagination = root.querySelector<HTMLElement>('[data-gifts-pagination]');
  const available = root.querySelector<HTMLInputElement>('[data-gifts-available]');
  if (!grid || !status || !pagination || !available) return;

  let line: GiftLine = '';
  let priceBand: GiftPriceBand = '30000';
  let currentPage = 1;
  let items: StorefrontProduct[] = [];

  const renderPage = (): void => {
    const maxPrice = Number(priceBand);
    const pageCount = Math.max(1, Math.ceil(items.length / GIFT_PAGE_SIZE));
    currentPage = Math.min(Math.max(currentPage, 1), pageCount);
    const start = (currentPage - 1) * GIFT_PAGE_SIZE;
    const visibleItems = items.slice(start, start + GIFT_PAGE_SIZE);
    grid.innerHTML = visibleItems.map((product, index) => renderProductCard(product, index < 4)).join('');
    grid.setAttribute('aria-busy', 'false');
    status.textContent = `${items.length} ${items.length === 1 ? 'producto' : 'productos'} · hasta $${new Intl.NumberFormat('es-CO').format(maxPrice)}`;
    if (items.length === 0) grid.innerHTML = '<div class="catalog-empty">No hay productos publicados que cumplan estos filtros por ahora.</div>';
    bindProductInteractions(grid, visibleItems, openProductDetail);
    pagination.innerHTML = items.length > GIFT_PAGE_SIZE ? `
      <button type="button" data-gifts-prev ${currentPage <= 1 ? 'disabled' : ''}>← Anterior</button>
      <span>Página ${currentPage} de ${pageCount}</span>
      <button type="button" data-gifts-next ${currentPage >= pageCount ? 'disabled' : ''}>Siguiente →</button>
    ` : '';
    pagination.querySelector<HTMLButtonElement>('[data-gifts-prev]')?.addEventListener('click', () => {
      currentPage -= 1;
      renderPage();
      root.querySelector('#gifts-title')?.scrollIntoView({ behavior: 'smooth' });
    });
    pagination.querySelector<HTMLButtonElement>('[data-gifts-next]')?.addEventListener('click', () => {
      currentPage += 1;
      renderPage();
      root.querySelector('#gifts-title')?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const load = async (): Promise<void> => {
    grid.setAttribute('aria-busy', 'true');
    status.textContent = 'Cargando…';
    pagination.innerHTML = '';
    currentPage = 1;
    const maxPrice = Math.min(Number(priceBand), GIFT_MAX_PRICE);
    try {
      const allItems: StorefrontProduct[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore && offset < 1000) {
        const page = await getStorefrontProducts({
          limit: 96,
          offset,
          businessLine: line || null,
          maxPrice,
          availableOnly: available.checked,
        });
        allItems.push(...page.items);
        offset += page.items.length;
        hasMore = page.hasMore && page.items.length > 0;
      }
      items = allItems;
      renderPage();
    } catch (error) {
      grid.setAttribute('aria-busy', 'false');
      status.textContent = error instanceof Error ? error.message : 'No fue posible cargar las ideas para regalar.';
      grid.innerHTML = '<div class="catalog-empty">Intenta nuevamente en unos segundos.</div>';
    }
  };

  root.querySelectorAll<HTMLInputElement>('input[name="gift-line"]').forEach((input) => input.addEventListener('change', () => {
    if (input.checked) { line = input.value as GiftLine; void load(); }
  }));
  root.querySelectorAll<HTMLInputElement>('input[name="gift-price"]').forEach((input) => input.addEventListener('change', () => {
    if (input.checked) { priceBand = input.value as GiftPriceBand; void load(); }
  }));
  available.addEventListener('change', () => void load());

  await load();
}
