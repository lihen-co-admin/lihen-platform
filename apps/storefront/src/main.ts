const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Storefront root not found.');

app.innerHTML = `
  <section style="max-width:760px;margin:80px auto;padding:24px;font-family:system-ui">
    <p style="letter-spacing:.12em;font-size:12px">LIHEN STOREFRONT · FASE 5</p>
    <h1>Storefront canónico en preparación</h1>
    <p>Este workspace consumirá la misma verdad canónica de Product Master y Catálogo.</p>
    <p>La publicación permanece bloqueada hasta cerrar FASE 3.11 y habilitar el gate de FASE 4.</p>
    <p>LIHEN_WEB_RENACER continúa siendo legacy mientras la capacidad equivalente nueva no esté validada.</p>
  </section>
`;
