# FASE 6.2 — Storefront release artifact integrity

Estado: IMPLEMENTED — pendiente de ejecución sobre un build de release.

El Storefront usa `base: './'` para soportar despliegue estático bajo subruta con hash router.

`tooling/validate-storefront-dist.mjs` inspecciona el artefacto compilado y bloquea la publicación si encuentra:

- marcadores de service-role;
- `products.js`;
- `catalog_public` legacy;
- `data/catalog-v1`;
- credenciales DEV de autenticación.

Script integrado: `pnpm build:storefront:release`.
