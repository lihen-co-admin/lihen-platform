# TANDA 15 · CUT8 V5 — Shared Institutional Backbone

Fecha: 2026-08-30

## Objetivo

Páginas 1, 2, 3, 4 y la página final constituyen un **backbone institucional único**.

Los tres modos del renderer:

- ALL
- BEAUTY_CARE
- STYLE

consumen el mismo `catalogInstitutionalComposition.getSnapshot(versionId)`.

## Regla de negocio

No existen versiones institucionales separadas por línea.

Si el contenido institucional se modifica en Control Center y se captura un nuevo snapshot institucional para una versión DRAFT, ese snapshot es la única fuente que usarán Beauty Care y STYLE para:

- página 1;
- página 2 · ¿Quiénes somos?;
- página 3 · Información de compra;
- página 4 · Medios de pago;
- página final · Conecta con LIHEN.

Esto preserva la semántica de snapshots: una versión ya congelada no se modifica silenciosamente.

## Cambios

1. La portada institucional deja de estar limitada a `line=ALL`.
2. BEAUTY_CARE y STYLE usan la misma portada institucional.
3. Las páginas institucionales dejan de sustituir su `footerLabel` según business line.
4. Se declara `SHARED_INSTITUTIONAL_BACKBONE` como contrato explícito para LIHEN Intelligence y trazabilidad.
5. El cuerpo comercial continúa siendo independiente por línea.

## LIHEN Intelligence

La inteligencia debe detectar las páginas `[1,2,3,4,FINAL]` como `SINGLE_SOURCE_SHARED_SNAPSHOT`.

No puede:
- generar una variante STYLE de esas páginas;
- generar una variante Beauty Care de esas páginas;
- duplicar imágenes institucionales;
- introducir overrides de texto, QR o medios de pago por business line.

Sí puede:
- validar que ambas líneas consumen el mismo snapshot;
- alertar si aparece un branch institucional específico por línea;
- verificar que las imágenes/QR institucionales provienen del mismo contenido congelado.

## Fuera de alcance

No toca:
- Supabase schema;
- migraciones;
- Product Master;
- Storefront;
- publishing;
- PROD;
- portadas de categoría STYLE;
- fichas de producto STYLE.
