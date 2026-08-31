# TANDA 15 · CUT8 — STYLE PRODUCT VISUAL CONTRACT

Fecha: 2026-08-30

Implementa el contrato visual aprobado de la ficha de producto STYLE:
- fondo crema/rosa/lila;
- COLECCIÓN 2026 + logo LIHEN + LIHEN.CO STYLE;
- panel editorial de referencia/nombre;
- protagonista grande;
- un único precio: `salePrice`, rotulado `Precio por unidad`;
- CTA contextual;
- sin superficie de precio mayorista ni información interna/proveedor.

La preparación de imagen queda declarada como contrato:
DETECT_PRIMARY_SUBJECT → REMOVE_OR_CLEAN_BACKGROUND → PRESERVE_PRODUCT_FIDELITY → REFRAME_FOR_EDITORIAL_LAYOUT → INTEGRATE_ON_STYLE_BACKGROUND.

El renderer marca los assets actuales como `CUTOUT_REQUIRED`. No se simula una eliminación de fondo con CSS.

No toca Beauty Care, Storefront, Supabase, migraciones, Product Master, snapshots, publishing ni PROD.
