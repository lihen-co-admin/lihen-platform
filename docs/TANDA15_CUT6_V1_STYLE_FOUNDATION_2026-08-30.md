# TANDA 15 · CUT6 · V1 — STYLE FOUNDATION

Fecha: 2026-08-30
Recovery baseline: `7c9108cebbba33e99a99b0893fbc5f7ad33ec4c6`

## Implementado
Foundation visual reusable para `LIHEN.CO STYLE` sin activar publicación ni alterar datos.

### Tokens Style
Crema, beige, nude, blanco cálido, café, dorado, rosa empolvado y lila suave.

### Tipografía
Serif editorial para títulos y sans serif funcional para información.

### A/B/C/D
Se formalizan `A | B | C | D` y una rotación semilla `A → B → C → D`.
CUT6 V1 no fuerza todavía layouts completos; eso corresponde a V2.

### Control global de rostros
Contrato `NOSE_DOWN_MAX`:
- aplica también a rostros secundarios;
- permite recorte, reencuadre, reposicionamiento, escala moderada, límite de marco y recurso editorial;
- prohíbe generar/reconstruir caras, cambiar modelo, inventar anatomía o transformar el producto.

V1 no aplica un recorte ciego automático porque podría cortar la prenda. La corrección concreta por fotografía debe validarse en V3 Pilot.

### Integración
El renderer expone:
- `data-business-line`
- `data-style-identity`
- `data-face-policy`

## No tocado
Supabase, migraciones, RLS, Product Master, snapshots, publicación, cutover, PROD, lógica de negocio y Storefront web.

## Siguiente bloque
V2 — STYLE TEMPLATES: portada, separadores, A, B, C, D, producto simple, producto múltiple y variantes.
