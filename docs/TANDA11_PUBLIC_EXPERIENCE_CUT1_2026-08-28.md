# TANDA 11 — Public Experience · CUT 1
Fecha: 2026-08-28

## Objetivo
Iniciar el pulido de la experiencia pública con estados consistentes y accesibles en Catálogo e Ideas para regalar.

## Cambios
Se agrega `public-experience-state.ts` para resolver:
- LOADING
- READY
- EMPTY
- ERROR

La resolución define:
- `role`
- `aria-live`
- `aria-busy`
- mensaje visible

También se agrega `publicScrollBehavior()` para respetar `prefers-reduced-motion` al paginar.

## Integración
### Catálogo
- estado de carga con `aria-busy`;
- error con `role="alert"` y anuncio assertive;
- vacío y listo con `role="status"` polite;
- scroll de paginación respeta reduced motion.

### Ideas para regalar
- misma semántica de estados;
- misma política de reduced motion;
- no cambia el filtro comercial de hasta $30.000 COP.

## Invariantes
- Solo lectura pública.
- Sin writes.
- Sin RPC nuevos.
- Sin migraciones.
- Sin cambios PROD.
- Sin alterar eligibility/publication.
- Sin alterar precios, disponibilidad, filtros o Product Master.
