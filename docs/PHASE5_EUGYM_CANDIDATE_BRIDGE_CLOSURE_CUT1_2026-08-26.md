# FASE 5 — EUGYM Candidate Bridge Closure CUT 1

Fecha: 2026-08-26

## Objetivo

Cerrar de forma no destructiva el Candidate Bridge del documento de proveedor
`CATÁLOGO EUGYM SPORT.pdf`, reconciliando sus 23 registros extraídos contra el
Product Master STYLE existente.

## Hallazgo técnico

El RPC controlado `public.build_supplier_product_candidates_controlled(...)`
falló inicialmente en DEV porque el entorno PostgreSQL no dispone de
`min(uuid)`. El fallo ocurrió dentro de una transacción y no dejó escritura
parcial.

Este corte corrige únicamente esa incompatibilidad, reemplazando los agregados
`min(uuid)` por selección determinística mediante `array_agg(... order by ...)`.
No cambia el contrato funcional del bridge y no crea ni publica productos.

## Resultado verificado en DEV

Proyecto DEV: `lihen-platform-dev`.

Candidate run generado:

`d7904957-2d89-4e1a-b5eb-0f5088f6ea0d`

Resultado del bridge:

- registros procesados: 23
- `EXISTING_MATCH`: 23
- `READY_CANDIDATE`: 0
- `REVIEW_REQUIRED` como disposición de bridge: 0
- `REJECTED`: 0
- productos nuevos creados: 0
- publicaciones ejecutadas: 0

Los 23 registros del PDF coincidieron exactamente por nombre normalizado dentro
de la línea STYLE con productos canónicos existentes, correspondientes al rango
ST-019 .. ST-041.

## Revisión controlada

Los 23 candidatos de revisión generados por el bridge fueron resueltos mediante
`LINK_EXISTING_PRODUCT`, cada uno apuntando a su `matched_product_id` canónico.

Resultado final:

- decisiones de revisión: 23
- `LINK_EXISTING_PRODUCT`: 23
- productos STYLE totales: 40
- productos STYLE visibles en web: 0

La reconciliación no alteró Product Master, precio, inventario ni visibilidad.

## Seguridad

- DEV únicamente.
- Producción no fue tocada.
- Sin auto-publicación.
- Sin creación automática de productos.
- Sin duplicación de Product Master.
- El documento del proveedor queda vinculado a productos existentes mediante
  evidencia/review, no mediante mutación destructiva.
- STYLE continúa oculto (`visible_on_website = false`).

## Estado del gate

`EUGYM SUPPLIER CANDIDATE BRIDGE: PASS`

El bridge queda técnicamente resuelto. Cualquier trabajo posterior sobre STYLE
(publicación, media, inventario o precio) debe tratarse como un gate separado y
no como parte de este cierre.
