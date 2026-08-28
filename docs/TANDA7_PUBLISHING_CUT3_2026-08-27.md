# TANDA 7 — Publishing — CUT 3

Fecha de continuidad: 2026-08-27.

## Objetivo

Cerrar la interpretación determinística del cutover Storefront sin crear un segundo mecanismo de publicación ni ejecutar mutaciones automáticas.

## Implementación

Se incorpora `evaluatePublishingCutoverIntegrity()` para leer el run existente y comprobar:

- `source_count = eligible_count + blocked_count`;
- el source coincide con el snapshot congelado;
- no existen candidatos bloqueados antes de ejecutar;
- `already_visible_count`, baseline externo y `affected_count` permanecen dentro de rangos explicables;
- un run `EXECUTED` permanece en `REVIEW` hasta verificación explícita;
- un run `VERIFIED` solo se interpreta como `PASS` cuando sus métricas reproducen la ecuación del gate canónico:
  - expected = eligible;
  - actual = expected;
  - missing = 0;
  - outside current = outside baseline;
  - revalidation failures = 0;
  - storefront projection = expected + outside baseline.

`CatalogsPage` muestra este estado por separado de Publishing readiness y Artifact integrity. La ejecución del cutover requiere integridad `PASS`; la verificación sigue siendo un paso explícito y controlado por el RPC existente.

## Invariantes

- Product Master no publica directamente.
- No auto-publicación.
- No auto-repair.
- No migraciones nuevas.
- No RPC nuevos.
- No PROD.
- La verificación de base de datos continúa siendo autoridad; esta política solo interpreta evidencia.
