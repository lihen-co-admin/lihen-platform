# FASE 6.5 — Release Candidate independent verification

Estado: IMPLEMENTED — pendiente de ejecución real.

## Objetivo

Verificar de forma independiente que el manifiesto RC todavía corresponde al commit y al `apps/storefront/dist` presentes.

## Comando

```bash
pnpm check:storefront:release-candidate
```

Requiere `LIHEN_RELEASE_MANIFEST_PATH`.

## Verificaciones

- manifiesto fuera del repositorio;
- schema esperado;
- todas las validaciones registradas en PASS;
- flags de seguridad en `false`;
- commit del manifiesto = `HEAD`;
- cantidad de archivos, tamaño total y SHA-256 agregado del dist;
- SHA-256 y tamaño por archivo;
- ausencia de material con apariencia de service-role, secret key o JWT.

No consulta ni modifica producción.
