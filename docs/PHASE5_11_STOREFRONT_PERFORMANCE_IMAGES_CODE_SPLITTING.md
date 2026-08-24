# FASE 5.11 — Performance + imágenes + code splitting

## Estado de implementación
IMPLEMENTED — pendiente de medición/gate integral.

## Alcance
- Catálogo cargado con `import()` únicamente al entrar a `#catalogo`.
- Rails de productos hidratados después de pintar Home.
- `loading=lazy` y `decoding=async` en imágenes no críticas.
- Primeras imágenes visibles reciben prioridad para evitar retrasar LCP innecesariamente.
- El RPC limita cada lectura y no descarga las 952 filas para pintar una página.
- No se añade framework ni dependencia de UI nueva.
