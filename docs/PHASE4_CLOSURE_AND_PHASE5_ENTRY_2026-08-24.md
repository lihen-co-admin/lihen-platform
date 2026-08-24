# FASE 4 — cierre técnico y entrada a FASE 5

## Invariante de publicación PDF

Solo puede existir una versión PDF `ACTIVE`. Al activar una nueva versión, la anterior se archiva de forma atómica y conserva sus snapshots.

Estado reconciliado en DEV:

- V1: `ARCHIVED`.
- V2: `ACTIVE`.

## Artefacto final

El artefacto PDF final se registra desde una sesión OWNER/ADMIN en Control Center:

1. seleccionar el PDF revisado;
2. calcular SHA-256 en navegador;
3. determinar páginas y tamaño;
4. subir a `catalog-pdf-artifacts`;
5. registrar metadata mediante RPC controlado;
6. evaluar `PHASE4_CANONICAL_PDF_PUBLICATION_EXIT_GATE_V1`.

El refinamiento visual de páginas institucionales 2, 3 y 4 queda como `NON_BLOCKING`.

## Entrada FASE 5 — Storefront

Referencia visual oficial: `LIHEN_WEB_RENACER`.

Regla:

- visual/UX: conservar y evolucionar la identidad de `LIHEN_WEB_RENACER`;
- datos/arquitectura: usar LIHEN Platform y su verdad canónica.

Componentes legacy útiles como referencia visual/UX:

- hero carousel;
- mega menu;
- product cards;
- product modal/detail;
- filtros;
- carruseles de marcas/productos;
- responsive;
- WhatsApp y selección.

No reutilizar como fuente de verdad `products.js`, CSV públicos, precios o stock hardcodeados.

Flujo objetivo:

`Product Master → Publication Policy → Storefront Projection → Composition → UI`.

## Candidato revisado 2026-08-24

Archivo revisado visualmente por la usuaria antes del registro definitivo:

- páginas: 227;
- formato: A4;
- tamaño: 57.983.560 bytes;
- SHA-256: `5021585bbe2ff96470528ae78aeeee14f1ab4891179fa8955bbf9c64db1aba0d`;
- última página: `CONECTA CON LIHEN`.

El valor se vuelve canónico únicamente cuando la usuaria selecciona ese mismo archivo en Control Center y el RPC de registro confirma el artefacto desde su sesión OWNER.
