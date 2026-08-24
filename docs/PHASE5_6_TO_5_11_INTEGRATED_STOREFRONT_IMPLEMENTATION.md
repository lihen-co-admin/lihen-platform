# FASE 5.6 → 5.11 — Implementación acumulada Storefront

Estado: IMPLEMENTED / AWAITING_INTEGRATED_GATE.

Este bloque se implementa acumulativamente por decisión operativa: no se realiza un gate manual en PC entre cada subfase. Ninguna subfase 5.6–5.11 se considera formalmente cerrada hasta pasar la validación integral previa a FASE 5.12.

## Contrato de datos
El Storefront lee productos únicamente mediante `public.get_storefront_products_controlled`, otorgado a `anon` y `authenticated`. No expone stock exacto y conserva las abstracciones `AVAILABLE`, `LOW_STOCK`, `COMING_SOON` y `OUT_OF_STOCK`.

## Bloques
- 5.6: product cards y rails canónicos.
- 5.7: búsqueda, filtros y paginación.
- 5.8: detalle y galería.
- 5.9: selección local y WhatsApp.
- 5.10: responsive, accesibilidad y SEO.
- 5.11: lazy images, lecturas limitadas y code splitting del catálogo.

## Gate pendiente
Antes de FASE 5.12 se debe ejecutar en PC:
1. `pnpm check` completo.
2. validación funcional con datos DEV reales.
3. revisión visual desktop y móvil.
4. navegación, filtros, detalle, selección y WhatsApp.
5. revisión de consola/network y carga de imágenes.
6. correcciones acumuladas si existen.

FASE 5.12 será el E2E + Storefront exit gate y no se adelantará sin ese control.
