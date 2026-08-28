# TANDA 2 — Product Master Completion · CUT 2

Fecha: 2026-08-27

## Alcance

Este corte completa la capa de media operativa del Product Master sin alterar las reglas de publicación:

- `ProductImagesPage` adopta la LIHEN Admin Foundation.
- se separan explícitamente galería canónica, evidencia visual y publicación;
- se incorpora una lectura determinista de completitud: imágenes registradas, principal y cobertura de texto alternativo;
- Lens Mode se presenta como asistencia DEV y evidencia explicable, nunca como mutación automática;
- se añade puente visible hacia Catálogos cuando la media está operativamente completa;
- la interfaz deja de presentar mensajes de fase histórica como copy principal.

## Invariantes preservados

1. Lens Mode no publica imágenes ni modifica Product Master automáticamente.
2. Media completa no equivale a elegibilidad de catálogo/storefront.
3. La escritura de `product_images` sigue detrás de sus gates existentes.
4. No se habilita execution, dispatch ni canary real.
5. Producción queda fuera de alcance.
6. La recomendación de Intelligence es read-only y requiere decisión humana.

## Definition of Done del corte

- Fundamentos y responsabilidades claras.
- Sin duplicar dominio de publicación dentro de Product Images.
- Sin writes directos a tablas desde UI.
- UX consistente con Admin Foundation.
- Accesibilidad visual: alt coverage visible y estados entendibles.
- QA requerido: `git diff --check`, `pnpm check`, `git status`.
