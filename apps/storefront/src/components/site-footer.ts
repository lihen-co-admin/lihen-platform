import lihenLogoUrl from '../assets/brand/lihen-logo-official.png';
import { buildCatalogHref } from './catalog-navigation';

export function renderSiteFooter(): string {
  return `
    <footer class="site-footer" id="contacto">
      <div class="site-footer__grid lihen-shell">
        <div class="site-footer__brand">
          <img src="${lihenLogoUrl}" alt="LIHEN.CO" />
          <p>Belleza, estilo y creatividad con propósito.</p>
          <span>Tienda virtual · Cali, Colombia.</span>
        </div>
        <div>
          <h2>Explora</h2>
          <a href="${buildCatalogHref({ businessLine: 'BEAUTY_CARE' })}">Beauty Care</a>
          <a href="${buildCatalogHref({ businessLine: 'STYLE' })}">Style</a>
          <a href="#marcas">Marcas</a>
          <a href="#regalos">Ideas para regalar</a>
          <a href="#nosotros">Nosotros</a>
        </div>
        <div>
          <h2>Contacto</h2>
          <a href="https://wa.me/message/2JDWBH57SQG4F1" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a href="mailto:hl.lihen.co@gmail.com">hl.lihen.co@gmail.com</a>
          <a href="#pqrs">Peticiones, quejas y reclamos</a>
          <a href="#consumidor">Derechos del consumidor</a>
        </div>
        <div class="site-footer__legal">
          <h2>Información</h2>
          <a href="#terminos">Términos y condiciones</a>
          <a href="#privacidad">Privacidad y datos</a>
          <a href="#cambios-devoluciones">Cambios y devoluciones</a>
          <a href="#envios">Política de envíos</a>
          <a href="https://sedeelectronica.sic.gov.co/" target="_blank" rel="noopener noreferrer">Superintendencia de Industria y Comercio</a>
        </div>
      </div>
      <div class="site-footer__bottom lihen-shell">
        <span>© 2026 LIHEN.CO</span>
        <span>Beauty Care | Style</span>
      </div>
    </footer>
  `;
}
