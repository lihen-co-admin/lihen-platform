# TANDA 15 · CUT8 V6 — STYLE Commercial Body Preview

Fecha: 2026-08-30

## Objetivo
Mostrar en el renderer real el recorrido completo:

1. páginas institucionales reales compartidas;
2. portadas de categoría STYLE aprobadas;
3. fichas de producto STYLE;
4. página final institucional real compartida.

El snapshot actual tiene 0 productos STYLE, por lo que V6 agrega un preview
**solo en DEV** mediante `?line=STYLE&stylePreview=1`.

## Seguridad
- no modifica el snapshot;
- no escribe Product Master;
- no toca Supabase;
- no habilita publishing;
- `canPrint` queda forzado a `false` durante el preview;
- el comportamiento normal `?line=STYLE` sigue mostrando 0 productos.

## Fixtures
Se usan cuatro fixtures locales únicamente para activar los contratos visuales:
- Enterizos;
- Falda + Top;
- Shorts;
- Hombre.

Las imágenes de preview fueron preparadas como PNG transparentes para evitar
el efecto de fotografía rectangular. No son datos canónicos ni se publican.

## Salida esperada
Pág. 1–4: institucional real
→ portada ENTERIZOS
→ producto ENTERIZOS
→ portada FALDA + TOP
→ producto FALDA + TOP
→ portada SHORTS
→ producto SHORTS
→ portada HOMBRE
→ producto HOMBRE
→ página final institucional real.
