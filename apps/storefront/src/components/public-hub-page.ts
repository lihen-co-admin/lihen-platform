import { getPublicHub, type PublicHubBlock } from './public-hub-api';
import { escapeHtml } from './storefront-product';

const money = (value: number | string | null) => value == null
  ? ''
  : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value));

const availabilityLabel: Readonly<Record<string, string>> = {
  AVAILABLE: 'Disponible',
  LOW_STOCK: 'Últimas unidades',
  COMING_SOON: 'Próximamente',
  OUT_OF_STOCK: 'Consultar disponibilidad',
};

function linkAttributes(url: string | null): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return ' target="_blank" rel="noopener noreferrer"';
  return '';
}

function imageHtml(block: PublicHubBlock, className = ''): string {
  if (!block.image_url) return '';
  const label = block.title ?? block.product_name ?? 'Contenido LIHEN';
  return `<img class="${className}" src="${escapeHtml(block.image_url)}" alt="${escapeHtml(label)}" loading="lazy" decoding="async">`;
}

function cardLink(block: PublicHubBlock, body: string, className = 'hub-card'): string {
  const href = block.target_url;
  if (!href) return `<article class="${className}">${body}</article>`;
  return `<a class="${className}" href="${escapeHtml(href)}"${linkAttributes(href)}>${body}</a>`;
}

export function renderPublicHubBlock(block: PublicHubBlock): string {
  const title = escapeHtml(block.title ?? '');
  const subtitle = escapeHtml(block.subtitle ?? '');
  const cta = escapeHtml(block.cta_label ?? 'Abrir');

  if (block.block_type === 'HEADING') {
    return `<header class="hub-heading"><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</header>`;
  }

  if (block.block_type === 'TEXT') {
    return `<article class="hub-text">${title ? `<h3>${title}</h3>` : ''}<p>${escapeHtml(block.body ?? '')}</p></article>`;
  }

  if (block.block_type === 'PRODUCT') {
    const availability = block.product_availability ? availabilityLabel[block.product_availability] ?? 'Consultar' : '';
    const body = `
      ${imageHtml(block, 'hub-product__image')}
      <span class="hub-product__copy">
        <small>${escapeHtml(block.product_brand ?? 'LIHEN')}</small>
        <strong>${title || escapeHtml(block.product_name ?? 'Producto')}</strong>
        <span class="hub-product__details">
          <em>${money(block.product_sale_price)}</em>
          ${availability ? `<span class="hub-availability hub-availability--${escapeHtml((block.product_availability ?? '').toLowerCase())}">${escapeHtml(availability)}</span>` : ''}
        </span>
      </span>
      <b class="hub-card__cta">${cta} →</b>`;
    return cardLink(block, body, 'hub-card hub-product');
  }

  if (block.block_type === 'BANNER') {
    const body = `
      ${imageHtml(block, 'hub-banner__image')}
      <span class="hub-banner__copy"><strong>${title}</strong>${subtitle ? `<small>${subtitle}</small>` : ''}${block.target_url ? `<b>${cta} →</b>` : ''}</span>`;
    return cardLink(block, body, 'hub-banner');
  }

  const icon = block.block_type === 'SOCIAL' ? '<span class="hub-card__icon" aria-hidden="true">◎</span>' : '';
  const body = `${icon}<span class="hub-card__copy"><strong>${title}</strong>${subtitle ? `<small>${subtitle}</small>` : ''}</span><b class="hub-card__cta">${cta} →</b>`;
  const className = `hub-card hub-card--${block.block_type.toLowerCase()}`;
  return cardLink(block, body, className);
}

export async function renderPublicHubPage(main: HTMLElement): Promise<void> {
  main.innerHTML = `
    <section class="public-hub-page" aria-labelledby="public-hub-title">
      <a class="hub-back-link" href="#inicio">← Tienda LIHEN</a>
      <header class="hub-profile">
        <span class="hub-monogram" aria-hidden="true">L</span>
        <p class="hub-profile__brand">LIHEN.CO</p>
        <h1 id="public-hub-title">Beauty Care · Style</h1>
        <span>Descubre productos, accesos y novedades seleccionadas por LIHEN.</span>
      </header>
      <div class="hub-loading" role="status" aria-live="polite">Cargando Hub…</div>
    </section>`;

  try {
    const blocks = await getPublicHub();
    const host = main.querySelector<HTMLElement>('.public-hub-page');
    if (!host) return;
    host.querySelector('.hub-loading')?.remove();
    host.insertAdjacentHTML(
      'beforeend',
      blocks.length
        ? `<section class="hub-stack" aria-label="Contenido destacado de LIHEN">${blocks.map(renderPublicHubBlock).join('')}</section>`
        : '<div class="hub-empty"><strong>Estamos preparando este espacio.</strong><span>Pronto encontrarás aquí nuestros accesos destacados.</span><a href="#catalogo">Explorar catálogo</a></div>',
    );
  } catch {
    const loading = main.querySelector<HTMLElement>('.hub-loading');
    if (loading) {
      loading.classList.add('hub-error');
      loading.innerHTML = '<strong>No fue posible cargar este contenido.</strong><span>Revisa tu conexión e intenta nuevamente.</span><button type="button" data-hub-retry>Reintentar</button>';
      loading.querySelector<HTMLButtonElement>('[data-hub-retry]')?.addEventListener('click', () => {
        void renderPublicHubPage(main);
      });
    }
  }
}
