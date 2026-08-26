# FASE 5 — Public Hub — QA final / cierre técnico

Fecha: 2026-08-26

## Alcance

Este corte no agrega nuevas tablas, buckets ni rutas paralelas. Su objetivo es cerrar la validación del flujo existente del Public Hub antes de declarar su capacidad técnicamente lista dentro de FASE 5.

Flujo cubierto:

`Control Center → Application → Domain → Repository/RPC → Supabase DEV → Public projection → Storefront`

## Evidencia incorporada en código

- Pruebas de aplicación para crear, publicar, reordenar y leer bloques mediante handlers.
- Rechazo de drafts inválidos antes de persistencia.
- Rechazo de IDs duplicados al reordenar.
- Clave de auditoría obligatoria para mutaciones.
- Se conservan las pruebas existentes de dominio, programación, seguridad del payload público, escape de HTML y Product Master canónico.

## Verificación DEV realizada

- La tabla privada del Hub no concede acceso directo a `anon` ni `authenticated`; la administración pasa por RPC controlado.
- `get_public_hub_controlled` mantiene acceso público controlado para la proyección de lectura.
- RPC administrativos permanecen para `authenticated` y aplican la autorización interna OWNER/ADMIN.
- El guard de publicación de PRODUCT sigue bloqueando productos que no estén publicables.
- No se dejaron bloques temporales persistidos durante las pruebas previas.
- Producción no fue modificada.

## Gate local pendiente

Antes de cerrar formalmente este corte deben ejecutarse en el repositorio real del usuario:

```bash
git diff --check
pnpm check
git status
```

No declarar PASS hasta contar con esa evidencia local completa.

## Criterio de cierre del Public Hub

Si el gate local termina en PASS y no aparecen regresiones introducidas por este corte, Public Hub puede considerarse técnicamente cerrado dentro de FASE 5. Esto no implica por sí mismo cerrar toda la FASE 5 ni iniciar FASE 6; los demás gates de FASE 5 conservan su estado independiente.
