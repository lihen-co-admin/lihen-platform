# FASE 5 · Public Hub · CUT 3

## Objetivo
Cerrar la preparación administrativa del flujo `crear → validar → guardar/publicar` sin duplicar datos de Product Master ni ampliar el esquema de base de datos.

## Cambios
- Validación de dominio reutilizable mediante `getPublicHubBlockValidationIssues`.
- Validación explícita de timestamps inválidos además de la regla inicio < fin.
- Control Center muestra un checkpoint visible de preparación antes de guardar.
- El botón de guardar queda bloqueado mientras existan errores de dominio conocidos.
- Al cambiar el tipo del bloque se limpian referencias que ya no pertenecen al nuevo tipo, reduciendo estados ambiguos y datos residuales.
- Pruebas de dominio para readiness y fechas inválidas.

## No cambia
- No hay migración nueva.
- No se modifica Product Master, inventario, precio ni media canónica.
- No se crea Storage adicional.
- No se toca producción.
- Los estados persistidos siguen siendo únicamente `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED`.

## Gate local requerido
Ejecutar en el repositorio real del usuario:

```bash
git diff --check
pnpm check
git status
```

No declarar PASS hasta observar la salida real de esos comandos.
