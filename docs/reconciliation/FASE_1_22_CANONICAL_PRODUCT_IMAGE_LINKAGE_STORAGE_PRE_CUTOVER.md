# FASE 1.22 — Canonical Product Image Linkage & Storage Pre-Cutover

Run: `39514b38-f90b-4b15-9ac1-0f12d8b1e625`

## Resultado
- 1,003 evidencias privadas registradas desde CATALOGO_LIHEN_V5_ACTL_V1.
- 952 productos BEAUTY_CARE enlazados a una evidencia exacta.
- 136 HUMAN_APPROVED + 816 POLICY_APPROVED.
- 6 REJECT + 45 DEFER excluidos.
- Dry-run: 952 READY_LINKAGE, 0 BLOCKED.
- 952 `product_image_id` deterministas y 952 rutas WEB deterministas.
- `public.product_images` sigue en 0.
- Storage objects siguen en 0.
- `main_image_url` y `visible_on_website` no se modificaron.

## Regla crítica de procedencia
Los crops del PDF son `CATALOG_EVIDENCE_CROP`. No se consideran originales canónicos del producto. En esta fase `original_upload_status = BLOCKED_EVIDENCE_IS_NOT_CANONICAL_ORIGINAL`. Solo se prepara la futura ruta WEB.

Ruta WEB planificada:
`products/{product_id}/{product_image_id}/web/{sha256}.jpg`

No se ejecutaron uploads ni inserts en `product_images`.
