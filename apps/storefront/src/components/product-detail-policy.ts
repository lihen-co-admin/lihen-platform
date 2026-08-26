import type { StorefrontMedia } from './storefront-media';
import { legacyMedia } from './storefront-media';
import type { StorefrontProduct } from './storefront-product';

export const PRODUCT_INFORMATION_VERIFICATION_COPY =
  'Estamos completando y verificando la información comercial de esta referencia antes de mostrarla.';

export const PRODUCT_INFORMATION_FAQ_ANSWER =
  'Priorizamos fuentes oficiales y evidencia aprobada antes de mostrar beneficios, ingredientes, tallas, materiales o recomendaciones.';

export function productDetailGallery(product: StorefrontProduct): StorefrontMedia[] {
  const fallback = product.card_media ?? legacyMedia(product.main_image_url);
  const limit = product.business_line === 'STYLE' ? 10 : 5;
  const source = product.gallery_media.length > 0
    ? product.gallery_media
    : product.detail_media
      ? [product.detail_media]
      : [fallback];

  return source
    .filter((media) => media.url.trim().length > 0)
    .filter((media, index, all) => all.findIndex((candidate) => candidate.url === media.url) === index)
    .slice(0, limit);
}

export function productDetailPendingItems(businessLine: string): string[] {
  return businessLine === 'STYLE'
    ? ['Material y composición.', 'Talla, ajuste y medidas.', 'Colores o variantes verificadas.', 'Cuidados de la prenda.']
    : ['Beneficios y atributos comerciales.', 'Presentación o contenido de la referencia.', 'Uso, cuidados o recomendaciones.'];
}
