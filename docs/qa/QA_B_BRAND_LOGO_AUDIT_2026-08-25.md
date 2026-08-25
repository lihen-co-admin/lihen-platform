# QA-B — Auditoría de logos de marca — DEV — 2026-08-25

## Regla

No se incorpora un logo a datos canónicos sin evidencia verificable de la marca. La UI puede usar un recurso empaquetado ya existente como fallback visual, pero eso no equivale a `logo_url` canónico aprobado.

## Estado observado en DEV

- 46 marcas con al menos un producto publicado.
- 0 de 46 tienen `brands.logo_url` canónico cargado.
- 10 cuentan actualmente con fallback visual empaquetado en Storefront: Bloomshell, Atenea, Purpure by Angie Bedoya, Vive Beauty, Girly, Madagascar Centella, Kaba, Destiny by La Segura, Ani-K y D'Luchi.
- Las demás deben permanecer como `MISSING_VERIFIED_SOURCE` hasta verificar fuente oficial o recibir evidencia humana.

## Flujo aprobado

1. Detectar `logo_url` faltante.
2. Buscar fuente oficial/verificable.
3. Confirmar correspondencia exacta de la marca.
4. Proponer el recurso, sin modificar datos canónicos silenciosamente.
5. Aprobación humana.
6. Carga al almacenamiento administrado por LIHEN y actualización canónica.

No se deben usar agregadores de logos, imágenes aleatorias de buscadores ni recursos con procedencia dudosa como fuente canónica.
