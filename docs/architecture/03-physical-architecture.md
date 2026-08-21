# Arquitectura física

- `apps/control-center`: UI privada.
- `apps/storefront`: web pública incremental.
- `apps/workers`: procesos de servidor.
- `packages/*`: dominios y capacidades.
- `database/*`: SQL físico versionado.

Dependency direction: UI → Application → Domain; Infrastructure implementa Ports.
