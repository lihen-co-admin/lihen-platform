# TANDA 2 — Product Master Completion · CUT 1

Fecha: 2026-08-27
Estado: IMPLEMENTADO / pendiente QA local

## Objetivo

Cerrar la primera capa de Product Master Completion sobre la LIHEN Admin Foundation ya validada, aplicando el estándar rector: fundamentos claros, separación de responsabilidades, refactoring mantenible, invariantes LIHEN, seguridad y UX consistente.

## Alcance

- Product Detail migrado a Admin Foundation.
- Create Product migrado a Admin Foundation.
- Update Product migrado a Admin Foundation.
- Change Product Sale Price migrado a Admin Foundation.
- LIHEN Intelligence read-only aplicada a identidad, taxonomía, lifecycle y pricing.
- Copy histórico de fases retirado de estas pantallas.
- Lifecycle lógico explícito: ACTIVE / INACTIVE / DISCONTINUED / ARCHIVED.
- No se implementa DELETE físico.
- Pricing permanece separado de Product Master y conserva semántica append-only.
- Inventario, media y publicación permanecen fuera de Create/Update.

## Invariantes preservados

1. Product Master no se elimina físicamente por una acción administrativa común.
2. Price change no se mezcla con UpdateProduct.
3. Intelligence no muta datos automáticamente.
4. La UI no escribe directamente a tablas de negocio.
5. Auth/configuración siguen controlando las capacidades de escritura.
6. No se toca producción.
7. No se habilita execution/canary/dispatch.

## Siguiente corte recomendado

CUT 2: Product Images + media readiness + Lens Mode UX + publication readiness bridge, sin fabricar galerías ni publicar automáticamente.
