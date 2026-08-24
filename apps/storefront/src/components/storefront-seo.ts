function ensureMeta(name: string, content: string, property = false): void {
  const attribute = property ? 'property' : 'name';
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, name);
    document.head.append(meta);
  }
  meta.content = content;
}

export function configureStorefrontSeo(): void {
  ensureMeta('description', 'Descubre Beauty Care y Style en LIHEN.CO. Consulta productos, marcas y disponibilidad con atención personalizada.');
  ensureMeta('og:title', 'LIHEN.CO | Beauty Care & Style', true);
  ensureMeta('og:description', 'Belleza, cuidado y estilo seleccionados para ti.', true);
  ensureMeta('og:type', 'website', true);
  ensureMeta('theme-color', '#fbf8f2');

  if (!document.head.querySelector('script[data-lihen-structured-data]')) {
    const structured = document.createElement('script');
    structured.type = 'application/ld+json';
    structured.dataset.lihenStructuredData = 'true';
    structured.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'OnlineStore',
      name: 'LIHEN.CO',
      url: 'https://lihen-co-admin.github.io/catalogo-lihen-co/',
      sameAs: [
        'https://www.instagram.com/lihen.co/',
        'https://www.tiktok.com/@lihen.co',
        'https://www.facebook.com/lihen.co.oficial',
      ],
    });
    document.head.append(structured);
  }
}
