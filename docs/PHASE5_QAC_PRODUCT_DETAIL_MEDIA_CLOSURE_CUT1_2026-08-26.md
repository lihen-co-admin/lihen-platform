# FASE 5 — QA-C Product Detail / Media Intelligence — cierre técnico CUT 1

Fecha: 2026-08-26
Entorno de datos revisado: Supabase DEV `vnmkupzptujtywnnabkp`
Producción: no modificada.

## Estado verificado en DEV

- 987 referencias en `beauty_media_intelligence_readiness`.
- 952 productos Beauty Care activos y visibles en storefront.
- 35 referencias sin media activa dentro del universo de readiness.
- 952 referencias con una sola imagen activa.
- 0 referencias con 2+ imágenes activas.
- 0 referencias con media `WEB_DETAIL`.
- 40 evidencias de enriquecimiento verificadas y aprobadas.
- 5 productos cuentan actualmente con enriquecimiento aprobado.

El faltante de galería premium y enriquecimiento masivo es **deuda de contenido/evidencia**, no autorización para inventar contenido ni copiar imágenes externas sin derechos.

## Riesgo encontrado en Product Detail

La página pública todavía exponía lenguaje interno como `LIHEN Intelligence` y el conteo de evidencias. Ese detalle pertenece al proceso interno de verificación, no a la experiencia del cliente.

También existía lógica de galería/pending fields dentro de `product-page.ts`, lo que dificultaba probar explícitamente las reglas de 5 imágenes Beauty Care / 10 Style, deduplicación y fallback seguro.

## Cambio del corte

- Extrae la política pura de Product Detail a `product-detail-policy.ts`.
- Mantiene máximo 5 imágenes para Beauty Care y 10 para Style.
- Deduplica por URL y no fabrica imágenes faltantes.
- Prioriza `gallery_media`; si no existe, usa `detail_media`; y solo después el fallback `card_media/main_image_url`.
- Conserva campos pendientes distintos para Beauty Care y Style.
- Retira lenguaje técnico/interno de la UI pública.
- No muestra al cliente el número de evidencias internas.
- Añade pruebas de regresión de estas reglas.

## Decisión de gate

Este corte permite separar dos conceptos:

1. **Readiness técnico de Product Detail**: la UI puede presentar de forma segura productos con contenido parcial, sin claims ni media inventada.
2. **Readiness de contenido/media**: seguirá aumentando únicamente cuando existan evidencia aprobada y assets con derechos válidos.

No se debe bloquear el cierre técnico del Product Detail esperando que los 952 productos tengan 2–5 imágenes. Esa cobertura se mantiene como deuda medible de Media Intelligence.

## No incluido

- no se modifica Product Master;
- no se modifica inventario, precio ni visibilidad;
- no se copian imágenes externas;
- no se cambian derechos de uso;
- no se crea una migración;
- no se inicia FASE 6.

## Gate local requerido

```bash
git diff --check
pnpm check
git status
```

Solo después de PASS se puede preparar el commit del corte.
