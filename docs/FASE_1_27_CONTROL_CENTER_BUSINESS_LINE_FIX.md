# FASE 1.27 — Control Center business-line type alignment

Corrección aplicada durante el gate de verificación autoritativo de Node 24 / pnpm 10.15.0.

## Hallazgos corregidos

- Los datos demo de `Category` usaban etiquetas visuales (`Beauty Care`, `Style`) donde el dominio exige los valores canónicos `BEAUTY_CARE` y `STYLE`.
- Los productos demo no enviaban el `businessLine` obligatorio del Product Master.
- CreateProduct y UpdateProduct no propagaban el `businessLine` requerido por los contratos actuales.
- La creación ahora selecciona explícitamente la línea de negocio y limita las categorías a la línea elegida.
- La actualización conserva la línea canónica leída del producto y la muestra como dato no editable en este flujo.
- El probe Auth/RLS ya no construye la propiedad opcional `email` con `undefined` explícito bajo `exactOptionalPropertyTypes`.

## Alcance

No se modificaron reglas de pricing, identidad, matching, visibilidad, RLS, persistencia, taxonomía canónica ni datos de Supabase. Los cambios alinean la UI de Control Center con contratos de dominio ya vigentes.
