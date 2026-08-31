# TANDA 15 · CUT6 · V2 — STYLE TEMPLATES

Fecha: 2026-08-30
Baseline de trabajo: CUT6 V1 aplicado sobre recovery `7c9108cebbba33e99a99b0893fbc5f7ad33ec4c6`.

## Implementado
- separador editorial Style;
- A — Editorial Split;
- B — Fashion Magazine;
- C — Frame / Arch;
- D — ADN LIHEN Evolucionado;
- página individual de producto Style;
- CTA visual preparado;
- microcopy conservador basado en marca/nombre real;
- precio únicamente desde `entry.salePrice`;
- hooks de política facial V1 preservados.

## Seguridad visual
V2 no aplica crop facial ciego. La geometría específica por imagen se valida en V3 Pilot para evitar cortar la prenda.

## Aislamiento por línea
- `STYLE`: usa páginas editoriales dedicadas.
- `BEAUTY_CARE`: conserva el renderer de cards existente.
- `ALL`: conserva el renderer existente.
- no se activa publicación Style;
- no se incorpora Product Master fuera del snapshot.

## No tocado
Supabase, migraciones, RLS, snapshots, Product Master, publicación, PROD y Storefront.

## Pendiente
V3 — STYLE PILOT con muestra real y validación de rostro/fidelidad/ritmo.
