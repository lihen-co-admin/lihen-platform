# TANDA 7 — Publishing · CUT 2

Estado: IMPLEMENTED — pendiente de validación local.

## Objetivo

Separar el readiness de flujo de la integridad del artefacto congelado. Un catálogo `PUBLISHED` no debe avanzar a Storefront solo porque exista metadata: esa metadata debe ser coherente y trazable.

## Implementación

Se añade `evaluatePublishingArtifactIntegrity()` como evaluación determinística y read-only.

### PASS

Requiere versión `ACTIVE`, snapshot no vacío, conteos coherentes, URL HTTP(S), SHA-256 hexadecimal de 64 caracteres, páginas y tamaño positivos dentro del límite de 100 MiB, `activatedAt` y `rendererVersion` presentes.

### REVIEW

Se utiliza cuando el artefacto aún no está publicado o cuando falta procedencia no destructiva, por ejemplo `activatedAt` o versión de renderer.

### BLOCKED

Bloquea avance de canal si existe corrupción o incoherencia material de metadata: URL inválida, SHA inválido, tamaño/páginas inválidos, snapshot vacío, versión no ACTIVE o conteos imposibles.

## Control Center

`CatalogsPage` ahora muestra `Artefacto PASS | REVIEW | BLOCKED`, añade insight específico y exige `PASS` antes de preparar o ejecutar el cutover Storefront.

No se añadió auto-publicación, auto-repair, migración, RPC, canary ni cambio PROD.
