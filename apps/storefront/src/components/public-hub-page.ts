import {
  getPublicHub,
  getPublicHubResources,
  type PublicHubBlock,
  type PublicHubResources,
} from './public-hub-api';
import { escapeHtml } from './storefront-product';
import lihenLogoUrl from '../assets/brand/lihen-logo-official.png';

const money = (value: number | string | null) => value == null
  ? ''
  : new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(Number(value));

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

function resourceIcon(kind: string): string {
  const icons: Readonly<Record<string, string>> = {
    store: '🛍',
    beauty: '✦',
    style: '✧',
    whatsapp: '◉',
    community: '♡',
    instagram: '◎',
    tiktok: '♪',
    facebook: 'f',
  };

  return `<span class="hub-resource__icon" aria-hidden="true">${icons[kind] ?? '•'}</span>`;
}

function resourceLink(
  url: string | null,
  label: string,
  detail: string,
  className: string,
  iconKind: string,
): string {
  if (!url) return '';

  return `
    <a class="hub-resource ${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
      ${resourceIcon(iconKind)}
      <span class="hub-resource__copy">
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(detail)}</small>
      </span>
      <span class="hub-resource__arrow" aria-hidden="true">›</span>
    </a>`;
}

function socialIconLink(url: string | null, label: string, icon: string): string {
  if (!url) return '';

  return `
    <a class="hub-social-icon" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)}">
      <span aria-hidden="true">${icon}</span>
    </a>`;
}

function renderHubResources(resources: PublicHubResources | null): string {
  if (!resources) return '';

  const socials = [
    socialIconLink(resources.instagramUrl, 'Instagram LIHEN', '◎'),
    socialIconLink(resources.tiktokUrl, 'TikTok LIHEN', '♪'),
    socialIconLink(resources.facebookUrl, 'Facebook LIHEN', 'f'),
    socialIconLink(resources.whatsappUrl, 'WhatsApp LIHEN', '◉'),
  ].filter(Boolean).join('');

  const primary = [
    resourceLink(resources.storefrontUrl, 'Tienda LIHEN', 'Explora productos y novedades', 'hub-resource--store', 'store'),
    resourceLink(resources.beautyCarePdfUrl, 'Catálogo Beauty Care', 'Consulta el catálogo PDF', 'hub-resource--beauty', 'beauty'),
    resourceLink(resources.stylePdfUrl, 'Catálogo Style', 'Descubre la colección Style', 'hub-resource--style', 'style'),
    resourceLink(resources.whatsappUrl, 'WhatsApp', 'Comprar o consultar', 'hub-resource--channel', 'whatsapp'),
    resourceLink(resources.whatsappCommunityUrl, 'Comunidad WhatsApp', 'Únete a la comunidad LIHEN', 'hub-resource--channel', 'community'),
    resourceLink(resources.instagramUrl, 'Instagram', '@lihen.co', 'hub-resource--channel', 'instagram'),
    resourceLink(resources.tiktokUrl, 'TikTok', '@lihen.co', 'hub-resource--channel', 'tiktok'),
    resourceLink(resources.facebookUrl, 'Facebook', 'LIHEN.CO oficial', 'hub-resource--channel', 'facebook'),
  ].filter(Boolean).join('');

  if (!primary && !socials) return '';

  return `
    ${socials ? `<nav class="hub-social-icons" aria-label="Redes sociales LIHEN">${socials}</nav>` : ''}
    <section class="hub-resources" aria-label="Accesos oficiales LIHEN">
      <div class="hub-resources__primary">${primary}</div>
    </section>`;
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
    const availability = block.product_availability
      ? availabilityLabel[block.product_availability] ?? 'Consultar'
      : '';

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
      <span class="hub-banner__copy">
        <strong>${title}</strong>
        ${subtitle ? `<small>${subtitle}</small>` : ''}
        ${block.target_url ? `<b>${cta} →</b>` : ''}
      </span>`;

    return cardLink(block, body, 'hub-banner');
  }

  const icon = block.block_type === 'SOCIAL'
    ? '<span class="hub-card__icon" aria-hidden="true">◎</span>'
    : '';

  const body = `${icon}<span class="hub-card__copy"><strong>${title}</strong>${subtitle ? `<small>${subtitle}</small>` : ''}</span><b class="hub-card__cta">${cta} →</b>`;

  return cardLink(block, body, `hub-card hub-card--${block.block_type.toLowerCase()}`);
}

export async function renderPublicHubPage(main: HTMLElement): Promise<void> {
  main.innerHTML = `
    <section class="public-hub-page" aria-labelledby="public-hub-title">
      <header class="hub-profile">
        <img class="hub-logo" src="${lihenLogoUrl}" alt="LIHEN.CO">
        <h1 id="public-hub-title">Beauty Care • Style</h1>
        <p class="hub-location">Cali, Colombia</p>
        <span>Tu acceso al universo LIHEN.</span>
      </header>
      <div class="hub-loading" role="status" aria-live="polite">Cargando Hub…</div>
    </section>`;

  const [blocksResult, resourcesResult] = await Promise.allSettled([
    getPublicHub(),
    getPublicHubResources(),
  ]);

  const host = main.querySelector<HTMLElement>('.public-hub-page');
  if (!host) return;

  host.querySelector('.hub-loading')?.remove();

  const resources = resourcesResult.status === 'fulfilled'
    ? resourcesResult.value
    : null;

  const blocks = blocksResult.status === 'fulfilled'
    ? blocksResult.value
    : [];

  const editorialBlocks = blocks.filter(
    (block) => block.block_type !== 'SOCIAL' && block.block_type !== 'HEADING',
  );

  host.insertAdjacentHTML('beforeend', renderHubResources(resources));

  host.insertAdjacentHTML(
    'beforeend',
    `<section class="hub-newsletter" aria-labelledby="hub-newsletter-title">
      <span class="hub-newsletter__eyebrow">Novedades LIHEN</span>
      <h2 id="hub-newsletter-title">Descubre primero lo nuevo</h2>
      <p>Sé la primera en descubrir lanzamientos, promociones y contenido exclusivo.</p>

      <form class="hub-newsletter__form" data-hub-newsletter>
        <label>
          <span>Tu nombre</span>
          <input type="text" name="name" autocomplete="name" placeholder="Tu nombre">
        </label>

        <label>
          <span>Tu correo electrónico</span>
          <input type="email" name="email" autocomplete="email" placeholder="correo@ejemplo.com">
        </label>

        <button type="button" disabled aria-disabled="true">
          Suscripción próximamente
        </button>

        <small>La integración de suscripción aún no está habilitada.</small>
      </form>
    </section>`,
  );

  if (editorialBlocks.length) {
    host.insertAdjacentHTML(
      'beforeend',
      `<section class="hub-editorial" aria-label="Contenido destacado">
        <p class="hub-resources__eyebrow">Así se vive LIHEN.CO</p>
        <div class="hub-stack">${editorialBlocks.map(renderPublicHubBlock).join('')}</div>
      </section>`,
    );
  }

  host.insertAdjacentHTML(
    'beforeend',
    `<footer class="hub-closing" aria-label="Cierre LIHEN">
      <span class="hub-closing__line" aria-hidden="true"></span>
      <img src="${lihenLogoUrl}" alt="LIHEN.CO">
      <span class="hub-closing__line" aria-hidden="true"></span>
      <p>Beauty Care • Style</p>
    </footer>`,
  );

  if (!resources && !editorialBlocks.length) {
    host.insertAdjacentHTML(
      'beforeend',
      `<div class="hub-empty hub-error">
        <strong>No fue posible cargar este contenido.</strong>
        <span>Revisa tu conexión e intenta nuevamente.</span>
        <button type="button" data-hub-retry>Reintentar</button>
      </div>`,
    );

    host.querySelector<HTMLButtonElement>('[data-hub-retry]')
      ?.addEventListener('click', () => {
        void renderPublicHubPage(main);
      });
  }
}
