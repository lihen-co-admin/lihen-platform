import lihenLogoUrl from '../assets/brand/lihen-logo-official.png';

export function renderSiteFooter(): string {
  return `
    <footer class="site-footer" id="contacto">
      <div class="site-footer__grid lihen-shell">
        <div class="site-footer__brand">
          <img src="${lihenLogoUrl}" alt="LIHEN.CO" />
          <p>Belleza, estilo y creatividad con propósito.</p>
          <span>Cali, Colombia.</span>
        </div>
        <div>
          <h2>Explora</h2>
          <a href="#beauty">Beauty Care</a>
          <a href="#style">Style</a>
          <a href="#marcas">Marcas</a>
          <a href="#experiencia">Experiencia LIHEN</a>
        </div>
        <div>
          <h2>Contacto</h2>
          <a href="https://wa.me/message/2JDWBH57SQG4F1" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a href="mailto:hl.lihen.co@gmail.com">hl.lihen.co@gmail.com</a>
          <a href="#inicio">Volver al inicio</a>
        </div>
      </div>
      <div class="site-footer__bottom lihen-shell">
        <span>© 2026 LIHEN.CO</span>
        <span>Beauty Cure | Style</span>
      </div>
    </footer>
  `;
}
