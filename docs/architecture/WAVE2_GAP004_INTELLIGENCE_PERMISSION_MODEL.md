# LIHEN WAVE 2 — GAP-004
## Intelligence Permission Model V1

**Base requerida:** `ae0b0b4b260e6055260d33b557c374e17ae0384b`  
**GAP:** GAP-004 — Intelligence Permission Model  
**Cambio funcional visible:** 0  
**Migraciones Supabase:** 0  
**Cambios RLS:** 0  
**Cambios PROD:** 0  
**Cambio de roles actuales:** 0  
**Marketing/Social implementation:** 0  

## Decisión de arquitectura

GAP-004 introduce un Permission Model puro dentro de `@lihen/intelligence-core`.
No reemplaza Auth, `packages/identity`, RLS ni el Existing Control Plane.

Separación obligatoria:

`Intelligence capability ≠ domain authorization ≠ human decision ≠ controlled command`

## Modelo

El motor utiliza default-deny y tres conceptos:

- `PermissionKey`: namespace extensible `domain.action`.
- `PermissionGrant`: ALLOW/DENY, opcionalmente scoped.
- `PermissionRequest`: permission + actionClass + scope.

Clases de acción:

- READ
- ANALYZE
- PROPOSE
- APPROVE
- MUTATE_MASTER
- PUBLISH
- FINANCE
- LIFECYCLE
- SECURITY

## Autonomía de Intelligence

Un actor `INTELLIGENCE` puede ser autorizado únicamente para clases READ, ANALYZE y
PROPOSE en este modelo base.

Aunque exista un grant mal configurado, el evaluador bloquea autonomía Intelligence para
APPROVE, MUTATE_MASTER, PUBLISH, FINANCE, LIFECYCLE y SECURITY.

Esto no sustituye Risk Policy, Human Decision, confirmation, Controlled Commands o RLS.

## Existing Identity / Roles

El repositorio real ya tiene roles `OWNER`, `ADMIN`, `OPERATOR`, `VIEWER` en
`packages/identity`. GAP-004 no replica esa lista ni decide todavía qué rol recibe cada
permiso. El mapping role → grants corresponde a integración/security posterior y debe
contrastarse con RLS en GAP-040.

## Existing Control Plane

El Control Center ya expone operation catalog con `domainCode`, `riskLevel`,
`requiresConfirmation`, `executionEnabled` y `ownerAdminOnly`.

GAP-004 no crea un segundo command engine. Posteriormente GAP-008 conectará:
Permission → Recommendation/Decision → Existing Operation Intent/Control Plane.

## Future Marketing / Social readiness

No se implementa Social.

El `PermissionKey` extensible permite añadir posteriormente, sin cambiar el motor,
permisos como:

- social.metrics_read
- social.comments_read
- marketing.content_create_draft
- marketing.content_approve
- social.publication_schedule
- social.publication_publish
- social.comment_reply
- social.comment_moderate
- social.account_connect

La existencia de una key nunca equivale a grant.

## Alcance negativo

- no tablas;
- no migraciones;
- no RLS;
- no OAuth;
- no APIs sociales;
- no UI;
- no role mapping;
- no Orchestrator;
- no ejecución;
- no cambio de lifecycle;
- no publishing;
- no finance writes.

Para DONE se exige `pnpm test:architecture` y `pnpm check` PASS.
