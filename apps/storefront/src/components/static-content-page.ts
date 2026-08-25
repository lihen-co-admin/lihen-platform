
export type StorefrontContentPage =
  | 'gifts'
  | 'about'
  | 'terms'
  | 'privacy'
  | 'returns'
  | 'shipping'
  | 'pqrs'
  | 'consumer';

const whatsappUrl = 'https://wa.me/message/2JDWBH57SQG4F1';
const sicUrl = 'https://sedeelectronica.sic.gov.co/';

function renderReviewNotice(): string {
  return `
    <aside class="content-page__notice" role="note">
      <strong>Contenido en revisión para publicación definitiva.</strong>
      <span>Esta estructura recupera una capacidad histórica de LIHEN en DEV. Los compromisos legales, plazos y condiciones deben ser aprobados antes del go-live.</span>
    </aside>
  `;
}

function renderTrustActions(): string {
  return `
    <div class="content-page__actions">
      <a class="lihen-button lihen-button--dark" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">Hablar con LIHEN</a>
      <a class="lihen-button lihen-button--outline" href="#pqrs">Peticiones y solicitudes</a>
    </div>
  `;
}

function renderAboutPage(): string {
  return `
    <section class="content-page content-page--about" aria-labelledby="about-title">
      <div class="content-page__hero lihen-shell">
        <p class="lihen-eyebrow">Nosotros</p>
        <h1 class="lihen-display" id="about-title">Belleza, cuidado y estilo desde Cali para Colombia.</h1>
        <p>LIHEN.CO es una tienda virtual que reúne Beauty Care y Style en una experiencia cercana, organizada y pensada para acompañar decisiones de compra con información clara.</p>
      </div>
      <div class="content-page__split lihen-shell">
        <article class="content-page__article">
          <h2>Una marca cercana</h2>
          <p>Seleccionamos productos de belleza, cuidado personal, maquillaje, accesorios y Style para ofrecerlos desde una sola experiencia digital.</p>
          <p>La plataforma que estás visitando se construye para que catálogo, inventario, precios, pedidos y atención compartan la misma información canónica.</p>
        </article>
        <article class="content-page__article">
          <h2>Dos líneas, una misma visión</h2>
          <p><strong>Beauty Care</strong> reúne productos para maquillaje, cuidado y bienestar cotidiano.</p>
          <p><strong>Style</strong> reúne prendas, accesorios y referencias que acompañan movimiento y expresión personal.</p>
        </article>
      </div>
      <div class="content-page__panel lihen-shell">
        <div>
          <p class="lihen-eyebrow">Conecta con LIHEN</p>
          <h2 class="lihen-display">Atención directa, sin perder cercanía.</h2>
          <p>Compra o consulta disponibilidad mediante WhatsApp. LIHEN funciona principalmente como tienda virtual.</p>
        </div>
        <a class="lihen-button lihen-button--dark" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">WhatsApp LIHEN</a>
      </div>
    </section>
  `;
}

function renderLegalPage(
  eyebrow: string,
  title: string,
  intro: string,
  sections: readonly { title: string; body: string }[],
): string {
  return `
    <section class="content-page content-page--legal" aria-labelledby="content-page-title">
      <div class="content-page__hero lihen-shell">
        <p class="lihen-eyebrow">${eyebrow}</p>
        <h1 class="lihen-display" id="content-page-title">${title}</h1>
        <p>${intro}</p>
        ${renderReviewNotice()}
      </div>
      <div class="content-page__legal-grid lihen-shell">
        ${sections.map((section) => `
          <article class="content-page__article">
            <h2>${section.title}</h2>
            <p>${section.body}</p>
          </article>
        `).join('')}
      </div>
      <div class="content-page__panel lihen-shell">
        <div>
          <p class="lihen-eyebrow">Canal de atención</p>
          <h2 class="lihen-display">¿Necesitas aclarar una condición?</h2>
          <p>Antes del go-live, esta información se consolidará con la versión aprobada por LIHEN. Mientras tanto, puedes comunicarte directamente con nuestro canal de atención.</p>
        </div>
        ${renderTrustActions()}
      </div>
    </section>
  `;
}

function renderPqrsPage(): string {
  return `
    <section class="content-page content-page--legal" aria-labelledby="pqrs-title">
      <div class="content-page__hero lihen-shell">
        <p class="lihen-eyebrow">Atención al consumidor</p>
        <h1 class="lihen-display" id="pqrs-title">Peticiones, quejas, reclamos y solicitudes.</h1>
        <p>LIHEN conserva un canal directo para recibir solicitudes relacionadas con compras, productos, atención, datos personales y experiencia de servicio.</p>
        ${renderReviewNotice()}
      </div>
      <div class="content-page__legal-grid lihen-shell">
        <article class="content-page__article">
          <h2>Cómo contactarnos</h2>
          <p>Envía tu solicitud por WhatsApp o al correo hl.lihen.co@gmail.com. Incluye la información necesaria para identificar tu compra o situación, evitando compartir datos sensibles que no sean necesarios.</p>
        </article>
        <article class="content-page__article">
          <h2>Qué puedes solicitar</h2>
          <p>Puedes presentar peticiones de información, solicitudes relacionadas con productos o pedidos, quejas sobre la atención y reclamos cuando consideres que una situación requiere revisión.</p>
        </article>
        <article class="content-page__article">
          <h2>Seguimiento</h2>
          <p>La versión definitiva de esta política establecerá canales, datos requeridos, tiempos y trazabilidad de respuesta antes de producción.</p>
        </article>
      </div>
      <div class="content-page__panel lihen-shell">
        <div>
          <p class="lihen-eyebrow">Tus derechos</p>
          <h2 class="lihen-display">También puedes consultar la autoridad de protección al consumidor.</h2>
          <p>La Superintendencia de Industria y Comercio ofrece información y trámites para consumidores en Colombia.</p>
        </div>
        <div class="content-page__actions">
          <a class="lihen-button lihen-button--dark" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">Contactar LIHEN</a>
          <a class="lihen-button lihen-button--outline" href="${sicUrl}" target="_blank" rel="noopener noreferrer">Ir a la SIC</a>
        </div>
      </div>
    </section>
  `;
}

function renderConsumerPage(): string {
  return `
    <section class="content-page content-page--legal" aria-labelledby="consumer-title">
      <div class="content-page__hero lihen-shell">
        <p class="lihen-eyebrow">Consumidor informado</p>
        <h1 class="lihen-display" id="consumer-title">Conoce tus derechos como consumidor.</h1>
        <p>LIHEN busca ofrecer información clara sobre productos, precios, disponibilidad, condiciones de compra y canales de atención.</p>
      </div>
      <div class="content-page__legal-grid lihen-shell">
        <article class="content-page__article">
          <h2>Información clara</h2>
          <p>Antes de comprar, revisa la referencia, precio, disponibilidad y condiciones aplicables al producto o pedido.</p>
        </article>
        <article class="content-page__article">
          <h2>Canales de atención</h2>
          <p>Si necesitas una aclaración, puedes contactar a LIHEN y utilizar el canal de PQRS disponible en esta tienda virtual.</p>
        </article>
        <article class="content-page__article">
          <h2>Superintendencia de Industria y Comercio</h2>
          <p>Para información oficial sobre protección al consumidor en Colombia, consulta directamente la sede electrónica de la SIC.</p>
          <a class="content-page__text-link" href="${sicUrl}" target="_blank" rel="noopener noreferrer">Consultar sede electrónica de la SIC →</a>
        </article>
      </div>
    </section>
  `;
}

export function renderStaticContentPage(page: StorefrontContentPage): string {
  switch (page) {
    case 'gifts':
      return '<div data-gifts-page></div>';
    case 'about':
      return renderAboutPage();
    case 'terms':
      return renderLegalPage(
        'Información de compra',
        'Términos y condiciones',
        'Estructura de condiciones generales para el uso de la tienda virtual y la relación comercial con LIHEN.',
        [
          { title: 'Alcance', body: 'La versión definitiva describirá el uso de la tienda virtual, la información de productos, la confirmación de disponibilidad y las condiciones aplicables a cada compra.' },
          { title: 'Precios y disponibilidad', body: 'Los precios y la disponibilidad deben confirmarse desde las fuentes canónicas de LIHEN y mediante los canales de atención cuando corresponda.' },
          { title: 'Pedidos y atención', body: 'La versión aprobada definirá confirmación, medios de pago, entrega, cambios, cancelaciones y demás condiciones comerciales aplicables.' },
        ],
      );
    case 'privacy':
      return renderLegalPage(
        'Datos personales',
        'Política de privacidad y tratamiento de datos',
        'Estructura destinada a explicar qué datos utiliza LIHEN, para qué finalidades y qué derechos tiene cada titular.',
        [
          { title: 'Datos y finalidad', body: 'La versión definitiva identificará los datos necesarios para atención, pedidos, contacto, cumplimiento y mejora de la experiencia, junto con sus finalidades.' },
          { title: 'Derechos del titular', body: 'La política aprobada describirá los mecanismos para conocer, actualizar, rectificar, solicitar supresión o revocar autorizaciones cuando legalmente corresponda.' },
          { title: 'Canal de consultas', body: 'Las solicitudes relacionadas con datos personales deberán tramitarse mediante los canales oficiales definidos por LIHEN.' },
        ],
      );
    case 'returns':
      return renderLegalPage(
        'Después de tu compra',
        'Cambios y devoluciones',
        'Estructura para comunicar de forma diferenciada las condiciones aplicables a Beauty Care, cuidado personal y Style.',
        [
          { title: 'Condiciones por producto', body: 'La versión definitiva debe diferenciar reglas según la naturaleza, higiene, estado, uso y presentación de cada línea de producto.' },
          { title: 'Solicitud', body: 'Se establecerán el canal, la información requerida, evidencia, validación y tiempos aplicables a cada solicitud.' },
          { title: 'Excepciones', body: 'Cualquier restricción deberá quedar escrita de forma clara, verificable y coherente con la normativa aplicable antes de publicación.' },
        ],
      );
    case 'shipping':
      return renderLegalPage(
        'Entrega de pedidos',
        'Política de envíos',
        'Estructura para explicar cobertura, preparación, despacho, entrega, costos y seguimiento de pedidos.',
        [
          { title: 'Cobertura', body: 'La política aprobada definirá zonas de entrega y condiciones aplicables a Cali y envíos hacia otros destinos.' },
          { title: 'Preparación y despacho', body: 'Se documentarán tiempos estimados, confirmación de disponibilidad, transportador o modalidad y eventos que puedan afectar la entrega.' },
          { title: 'Seguimiento', body: 'El pedido debe conservar trazabilidad suficiente para que LIHEN y el cliente puedan conocer su estado dentro del flujo operativo.' },
        ],
      );
    case 'pqrs':
      return renderPqrsPage();
    case 'consumer':
      return renderConsumerPage();
  }
}
