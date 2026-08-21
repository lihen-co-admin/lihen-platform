const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Storefront root not found.');

app.innerHTML = `
  <section style="max-width:760px;margin:80px auto;padding:24px;font-family:system-ui">
    <p style="letter-spacing:.12em;font-size:12px">LIHEN STOREFRONT</p>
    <h1>Workspace de migración incremental</h1>
    <p>Este workspace no reemplaza todavía LIHEN_WEB_RENACER en producción.</p>
  </section>
`;
