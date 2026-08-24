import { getStorefrontProducts } from './storefront-api';
import { renderProductCard } from './product-card';
import { bindProductInteractions } from './product-interactions';
import { openProductDetail } from './product-detail';
import { escapeHtml, type StorefrontProductQuery } from './storefront-product';

const PAGE_SIZE = 24;

interface CatalogState {
  query: string;
  businessLine: string;
  brand: string;
  category: string;
  page: number;
}

const knownCategories = [
  'CEPILLOS Y ACCESORIOS PARA EL CABELLO',
  'CEJAS, PESTAÑAS Y DELINEADORES',
  'ACCESORIOS PARA MAQUILLAJE',
  'LABIALES, BRILLOS, DELINEADORES, HIDRATANTES Y TINTAS',
  'BASES, CORRECTORES, POLVOS, RUBORES E ILUMINADORES',
] as const;

const knownBrands = ['Bloomshell', 'MONTOC', 'Anyeluz', 'Milagros', 'Atenea', 'Olé Capilar', 'Purpure by Angie Bedoya', 'Vive Beauty', 'Kaba', 'Fem'] as const;

function readState(): CatalogState {
  const hash = location.hash.startsWith('#catalogo') ? location.hash.slice('#catalogo'.length) : '';
  const params = new URLSearchParams(hash.startsWith('?') ? hash.slice(1) : hash);
  return {
    query: params.get('q') ?? '',
    businessLine: params.get('business_line') ?? 'BEAUTY_CARE',
    brand: params.get('brand') ?? '',
    category: params.get('category') ?? '',
    page: Math.max(Number(params.get('page') ?? '1') || 1, 1),
  };
}

function writeState(state: CatalogState): void {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.businessLine) params.set('business_line', state.businessLine);
  if (state.brand) params.set('brand', state.brand);
  if (state.category) params.set('category', state.category);
  if (state.page > 1) params.set('page', String(state.page));
  const query = params.toString();
  history.replaceState(null, '', `#catalogo${query ? `?${query}` : ''}`);
}

function options(values: readonly string[], selected: string, emptyLabel: string): string {
  return `<option value="">${emptyLabel}</option>${values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}`;
}

function queryFromState(state: CatalogState): StorefrontProductQuery {
  return {
    limit: PAGE_SIZE,
    offset: (state.page - 1) * PAGE_SIZE,
    query: state.query || null,
    businessLine: state.businessLine || null,
    brand: state.brand || null,
    category: state.category || null,
  };
}

export function renderCatalogPage(): string {
  const state = readState();
  return `
    <section class="catalog-page lihen-shell" aria-labelledby="catalog-title">
      <div class="catalog-page__heading">
        <div><p class="lihen-eyebrow">Catálogo canónico</p><h1 class="lihen-display" id="catalog-title">Encuentra tu próximo favorito.</h1><p>Consulta productos publicados desde una sola fuente de LIHEN Platform.</p></div>
        <a class="catalog-page__home" href="#inicio">← Volver al inicio</a>
      </div>
      <form class="catalog-filters" data-catalog-filters role="search">
        <label class="catalog-search"><span>Buscar</span><input type="search" name="q" value="${escapeHtml(state.query)}" placeholder="Producto, marca o SKU" autocomplete="off" /></label>
        <label><span>Marca</span><select name="brand">${options(knownBrands, state.brand, 'Todas las marcas')}</select></label>
        <label><span>Categoría</span><select name="category">${options(knownCategories, state.category, 'Todas las categorías')}</select></label>
        <button class="lihen-button lihen-button--dark" type="submit">Buscar</button>
        <button class="catalog-filters__clear" type="button" data-catalog-clear>Limpiar</button>
      </form>
      <div class="catalog-status" data-catalog-status aria-live="polite">Cargando productos…</div>
      <div class="catalog-grid" data-catalog-grid aria-busy="true"></div>
      <nav class="catalog-pagination" aria-label="Paginación del catálogo" data-catalog-pagination></nav>
    </section>
  `;
}

export async function bindCatalogPage(root: HTMLElement): Promise<void> {
  const grid = root.querySelector<HTMLElement>('[data-catalog-grid]');
  const status = root.querySelector<HTMLElement>('[data-catalog-status]');
  const pagination = root.querySelector<HTMLElement>('[data-catalog-pagination]');
  const form = root.querySelector<HTMLFormElement>('[data-catalog-filters]');
  const clear = root.querySelector<HTMLButtonElement>('[data-catalog-clear]');
  if (!grid || !status || !pagination || !form || !clear) return;

  let state = readState();

  const load = async (): Promise<void> => {
    grid.setAttribute('aria-busy', 'true');
    status.textContent = 'Cargando productos…';
    pagination.innerHTML = '';
    try {
      const page = await getStorefrontProducts(queryFromState(state));
      grid.innerHTML = page.items.map((product, index) => renderProductCard(product, index < 4)).join('');
      grid.setAttribute('aria-busy', 'false');
      status.textContent = page.items.length > 0
        ? `Página ${state.page} · ${page.items.length} productos mostrados${page.hasMore ? ' · hay más resultados' : ''}.`
        : 'No encontramos productos con esos filtros.';
      bindProductInteractions(grid, page.items, openProductDetail);

      const prevDisabled = state.page <= 1;
      pagination.innerHTML = `
        <button type="button" data-page-prev ${prevDisabled ? 'disabled' : ''}>← Anterior</button>
        <span>Página ${state.page}</span>
        <button type="button" data-page-next ${page.hasMore ? '' : 'disabled'}>Siguiente →</button>
      `;
      pagination.querySelector<HTMLButtonElement>('[data-page-prev]')?.addEventListener('click', () => {
        state = { ...state, page: Math.max(1, state.page - 1) };
        writeState(state);
        void load();
        root.querySelector('#catalog-title')?.scrollIntoView({ behavior: 'smooth' });
      });
      pagination.querySelector<HTMLButtonElement>('[data-page-next]')?.addEventListener('click', () => {
        state = { ...state, page: state.page + 1 };
        writeState(state);
        void load();
        root.querySelector('#catalog-title')?.scrollIntoView({ behavior: 'smooth' });
      });
    } catch (error) {
      grid.setAttribute('aria-busy', 'false');
      status.textContent = error instanceof Error ? error.message : 'No fue posible cargar el catálogo.';
      grid.innerHTML = '<div class="catalog-empty">Intenta nuevamente en unos segundos.</div>';
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    state = {
      query: String(data.get('q') ?? '').trim(),
      businessLine: 'BEAUTY_CARE',
      brand: String(data.get('brand') ?? ''),
      category: String(data.get('category') ?? ''),
      page: 1,
    };
    writeState(state);
    void load();
  });

  clear.addEventListener('click', () => {
    form.reset();
    state = { query: '', businessLine: 'BEAUTY_CARE', brand: '', category: '', page: 1 };
    writeState(state);
    void load();
  });

  await load();
}
