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
const instagramUrl = 'https://www.instagram.com/lihen.co/';
const facebookUrl = 'https://www.facebook.com/lihen.co.oficial';
const tiktokUrl = 'https://www.tiktok.com/@lihen.co';

function renderPublicNotice(label: string, detail: string): string {
  return `
    <aside class="content-page__notice" role="note">
      <strong>${label}</strong>
      <span>${detail}</span>
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
          <p>Seleccionamos maquillaje, cuidado personal, accesorios y referencias Style para ofrecerlos desde una sola experiencia digital.</p>
          <p>Catálogo, inventario, precios, pedidos y atención se organizan alrededor de una misma referencia canónica para reducir inconsistencias.</p>
        </article>
        <article class="content-page__article">
          <h2>Dos líneas, una misma visión</h2>
          <p><strong>Beauty Care</strong> reúne maquillaje, cuidado y bienestar cotidiano.</p>
          <p><strong>Style</strong> reúne prendas y accesorios que acompañan movimiento y expresión personal.</p>
        </article>
      </div>
      <div class="content-page__panel lihen-shell">
        <div>
          <p class="lihen-eyebrow">Así se vive LIHEN.CO</p>
          <h2 class="lihen-display">Conecta con la tienda, novedades y contenido.</h2>
          <p>LIHEN funciona principalmente como tienda virtual. Puedes explorar el catálogo y seguir los canales oficiales para conocer lanzamientos, disponibilidad y contenido de Beauty Care y Style.</p>
        </div>
        <div class="content-page__actions">
          <a class="lihen-button lihen-button--dark" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a class="lihen-button lihen-button--outline" href="${instagramUrl}" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a class="lihen-button lihen-button--outline" href="${facebookUrl}" target="_blank" rel="noopener noreferrer">Facebook</a>
          <a class="lihen-button lihen-button--outline" href="${tiktokUrl}" target="_blank" rel="noopener noreferrer">TikTok</a>
        </div>
      </div>
    </section>
  `;
}

function renderLegalPage(eyebrow: string,title: string,intro: string,sections: readonly { title: string; body: string }[],notice?: string): string {
  return `
    <section class="content-page content-page--legal" aria-labelledby="content-page-title">
      <div class="content-page__hero lihen-shell">
        <p class="lihen-eyebrow">${eyebrow}</p>
        <h1 class="lihen-display" id="content-page-title">${title}</h1>
        <p>${intro}</p>
        ${notice ? renderPublicNotice('Información pública de LIHEN.CO', notice) : ''}
      </div>
      <div class="content-page__legal-grid lihen-shell">
        ${sections.map((section) => `<article class="content-page__article"><h2>${section.title}</h2><p>${section.body}</p></article>`).join('')}
      </div>
      <div class="content-page__panel lihen-shell">
        <div>
          <p class="lihen-eyebrow">Canal de atención</p>
          <h2 class="lihen-display">¿Necesitas aclarar una condición?</h2>
          <p>Antes de pagar, solicita el resumen de tu pedido con producto, cantidad, precio, envío, total y tiempo estimado de entrega.</p>
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
        <p>LIHEN dispone de canales directos para recibir solicitudes relacionadas con compras, productos, atención, datos personales y experiencia de servicio.</p>
        ${renderPublicNotice('Conserva la trazabilidad', 'Al enviar una solicitud, conserva el mensaje o correo con fecha y hora. Incluye solo la información necesaria para identificar tu pedido o situación.')}
      </div>
      <div class="content-page__legal-grid lihen-shell">
        <article class="content-page__article"><h2>Canales</h2><p>Escríbenos por WhatsApp o al correo hl.lihen.co@gmail.com. Para asuntos de pedido, incluye número de pedido o referencia cuando exista.</p></article>
        <article class="content-page__article"><h2>Qué puedes solicitar</h2><p>Información, seguimiento de pedidos, revisión de productos, quejas de atención, reclamos, garantías y solicitudes relacionadas con datos personales.</p></article>
        <article class="content-page__article"><h2>Protección al consumidor</h2><p>También puedes consultar directamente la información y trámites de la Superintendencia de Industria y Comercio.</p><a class="content-page__text-link" href="${sicUrl}" target="_blank" rel="noopener noreferrer">Consultar la SIC →</a></article>
      </div>
      <div class="content-page__panel lihen-shell"><div><p class="lihen-eyebrow">Contacto</p><h2 class="lihen-display">Estamos para orientarte.</h2><p>La atención por WhatsApp permite identificar la referencia o pedido antes de continuar.</p></div>${renderTrustActions()}</div>
    </section>
  `;
}

function renderConsumerPage(): string {
  return `
    <section class="content-page content-page--legal" aria-labelledby="consumer-title">
      <div class="content-page__hero lihen-shell">
        <p class="lihen-eyebrow">Consumidor informado</p>
        <h1 class="lihen-display" id="consumer-title">Conoce tus derechos como consumidor.</h1>
        <p>LIHEN busca ofrecer información clara sobre productos, precios, disponibilidad, condiciones de compra, entrega y canales de atención.</p>
      </div>
      <div class="content-page__legal-grid lihen-shell">
        <article class="content-page__article"><h2>Información clara</h2><p>Revisa referencia, precio, disponibilidad, cantidades, costo de envío y plazo estimado antes de confirmar el pago.</p></article>
        <article class="content-page__article"><h2>PQRS</h2><p>Si necesitas una aclaración o revisión, utiliza el canal de PQRS disponible en esta tienda virtual.</p><a class="content-page__text-link" href="#pqrs">Ir a PQRS →</a></article>
        <article class="content-page__article"><h2>Superintendencia de Industria y Comercio</h2><p>Consulta la sede electrónica oficial de la SIC. Este enlace es informativo y no implica aval, certificación ni recomendación de LIHEN.CO por parte de la entidad.</p><a class="content-page__text-link" href="${sicUrl}" target="_blank" rel="noopener noreferrer">Consultar sede electrónica de la SIC →</a></article>
      </div>
    </section>
  `;
}

export function renderStaticContentPage(page: StorefrontContentPage): string {
  switch (page) {
    case 'gifts': return '<div data-gifts-page></div>';
    case 'about': return renderAboutPage();
    case 'terms':
      return renderLegalPage('Información de compra','Términos y condiciones','Condiciones generales para utilizar la tienda virtual y confirmar una compra con LIHEN.CO.',[
        { title: 'Productos, precios y disponibilidad', body: 'La ficha pública muestra la referencia y el precio disponible en el catálogo. La disponibilidad, variantes y condiciones particulares se confirman antes del pago.' },
        { title: 'Confirmación del pedido', body: 'Antes del pago, el cliente debe recibir un resumen con producto, cantidad, precio unitario, subtotal, envío, descuentos, total, dirección o destino, medio de pago y plazo estimado.' },
        { title: 'Atención posterior', body: 'Envíos, cambios, garantía, retracto cuando legalmente corresponda y PQRS se atienden mediante los canales publicados por LIHEN.CO.' },
      ],'LIHEN.CO S.A.S. opera desde Cali, Colombia. Las condiciones particulares de cada pedido deben quedar expresamente confirmadas antes del pago.');
    case 'privacy':
      return renderLegalPage('Datos personales','Política de privacidad y tratamiento de datos','Información sobre el uso de datos necesarios para atender consultas, pedidos y solicitudes.',[
        { title: 'Finalidades', body: 'Los datos enviados voluntariamente se utilizan para responder consultas, gestionar pedidos, realizar seguimiento, atender solicitudes y cumplir obligaciones de la relación comercial.' },
        { title: 'Derechos del titular', body: 'El titular puede solicitar información, actualización, rectificación, supresión o revocatoria cuando legalmente corresponda, a través de los canales oficiales de LIHEN.CO.' },
        { title: 'Minimización', body: 'No envíes datos sensibles o información que no sea necesaria para atender tu consulta, pedido o solicitud.' },
      ],'El canal de contacto publicado permite ejercer solicitudes relacionadas con los datos personales entregados a LIHEN.CO.');
    case 'returns':
      return renderLegalPage('Después de tu compra','Cambios, devoluciones y garantía','Las solicitudes se revisan según la naturaleza del producto, su estado, la causa reportada y los derechos que legalmente correspondan.',[
        { title: 'Retracto y cambio comercial', body: 'El retracto por cambio de opinión, cuando legalmente aplique, y los cambios comerciales voluntarios son situaciones distintas y pueden tener condiciones diferentes.' },
        { title: 'Garantía', body: 'Una restricción de retracto o cambio comercial no elimina los derechos por producto defectuoso, inseguro, vencido, diferente a lo comprado o que incumpla lo ofrecido.' },
        { title: 'Reporte de novedad', body: 'Contacta a LIHEN.CO con la referencia o pedido y evidencia necesaria. En productos recibidos con daño de transporte, conserva empaque y fotografías para facilitar la revisión.' },
      ],'Beauty Care y Style pueden requerir condiciones distintas por higiene, uso, talla, estado y presentación; cada caso se revisa sin confundir cambio comercial con garantía.');
    case 'shipping':
      return `
        <section class="content-page content-page--legal" aria-labelledby="content-page-title">
          <div class="content-page__hero lihen-shell">
            <p class="lihen-eyebrow">Entrega de pedidos</p>
            <h1 class="lihen-display" id="content-page-title">Política de envíos</h1>
            <p>LIHEN.CO realiza envíos nacionales desde Cali y publica los tiempos estimados por zona.</p>
            ${renderPublicNotice('Política pública vigente · julio de 2026', 'Envío gratis en compras desde $100.000 COP. Los tiempos son estimados y pueden variar por cobertura, operador logístico, fuerza mayor o temporadas de alta demanda.')}
          </div>
          <div class="content-page__legal-grid lihen-shell">
            <article class="content-page__article"><h2>Cali</h2><p>Entrega a domicilio estimada de 1 a 3 días hábiles. Costo desde $5.000 COP y envío gratis en compras desde $100.000 COP.</p></article>
            <article class="content-page__article"><h2>Ciudades principales</h2><p>Tiempo estimado de 3 a 5 días hábiles. El costo depende de peso y destino. Envío gratis desde $100.000 COP.</p></article>
            <article class="content-page__article"><h2>Municipios y zonas rurales</h2><p>Tiempo estimado de 5 a 8 días hábiles, sujeto a cobertura del operador. Envío gratis desde $100.000 COP cuando exista cobertura.</p></article>
            <article class="content-page__article"><h2>Preparación y despacho</h2><p>Una vez confirmado y pagado el pedido, la preparación y empaque toma normalmente de 1 a 2 días hábiles. Al despachar, se informa la guía o el rango estimado de entrega para Cali.</p></article>
            <article class="content-page__article"><h2>Seguimiento</h2><p>Para novedades de envío escribe a hl.lihen.co@gmail.com o utiliza el canal de atención. Conserva el número de pedido o guía para facilitar el seguimiento.</p></article>
            <article class="content-page__article"><h2>Beneficios especiales</h2><p>Los beneficios de entrega por día, zona o campaña —incluido cualquier sábado con entrega gratis— solo se muestran cuando cuentan con vigencia, cobertura y cupos aprobados.</p><div data-delivery-policy></div></article>
          </div>
          <div class="content-page__panel lihen-shell"><div><p class="lihen-eyebrow">Antes de pagar</p><h2 class="lihen-display">Confirma destino, costo y plazo.</h2><p>El resumen del pedido debe indicar el costo de entrega aplicable y el plazo estimado para tu destino.</p></div>${renderTrustActions()}</div>
        </section>`;
    case 'pqrs': return renderPqrsPage();
    case 'consumer': return renderConsumerPage();
  }
}
