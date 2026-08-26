# FASE 5 — QA-C Product Detail / Media Intelligence — Closure CUT 2

Fecha: 2026-08-26

## Objetivo

Cerrar el gate técnico de Product Detail sin convertir la deuda de enriquecimiento visual/contenido en un bloqueo artificial de FASE 5.

## Estado verificado en DEV

El diagnóstico controlado separa dos dimensiones que no deben confundirse:

- `technical_status`: capacidad real de Product Detail / Storefront para publicar y leer productos canónicos con media segura de fallback.
- `media_content_debt_status`: deuda progresiva de galerías premium, derivados `WEB_DETAIL` y enriquecimiento aprobado.

Resultado verificado tras aplicar la migración en DEV:

- technical_status: `PASS`
- media_content_debt_status: `OPEN`
- readiness_total: 987
- visible_active_products: 952
- media_v2_publishable_products: 952
- no_media_products: 35
- single_image_products: 952
- multi_image_products: 0
- web_detail_products: 0
- gallery_ready_products: 0
- approved_evidence: 40
- products_with_approved_evidence: 5

## Política de cierre

Product Detail puede operar con el `WEB_CARD` canónico cuando no existe una galería enriquecida. La ausencia de 2–5 imágenes o de `WEB_DETAIL` no autoriza copiar imágenes externas, inventar media, alterar Product Master ni declarar una galería falsa.

Por tanto:

- el gate técnico puede estar en PASS;
- la deuda de Media Intelligence permanece abierta y medible;
- el enriquecimiento continúa de forma progresiva;
- cualquier nueva evidencia sigue su flujo de verificación/aprobación antes de llegar al Storefront;
- producción permanece intacta.

## Contrato de diagnóstico

La migración agrega:

- vista privada `lihen_private.phase5_qac_product_detail_media_closure_status`;
- RPC administrativo `public.get_phase5_qac_product_detail_media_closure_status_controlled()`;
- acceso RPC solo para `authenticated`, con autorización interna OWNER/ADMIN;
- `search_path` seguro y sin exposición directa de la vista privada a `anon`/`authenticated`.

## Deuda no bloqueante registrada

- `PHASE5_QAC_MEDIA_GALLERY_ENRICHMENT_PROGRESSIVE`
- `PHASE5_QAC_WEB_DETAIL_ASSETS_PROGRESSIVE`
- `PHASE5_QAC_APPROVED_ENRICHMENT_PROGRESSIVE`

Estas deudas no significan que el trabajo esté “hecho”: significan que ya no son precondición para la corrección técnica del Product Detail y deben seguirse como enriquecimiento progresivo basado en evidencia y derechos.
