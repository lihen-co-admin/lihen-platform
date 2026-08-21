# FASE 1.8.1 — Connected Supabase evidence

## Fecha de comprobación

2026-08-20

## Alcance

Se realizó **únicamente lectura** sobre el proyecto Supabase actualmente conectado, con el objetivo de comprobar si correspondía al DEV requerido por la FASE 1.8.1.

## Proyecto observado

- Nombre visible: `lihen-inauguracion`
- Project ref: `gqitoossdbiohqegjvlh`
- Estado: ACTIVE_HEALTHY
- Branches DEV detectadas: **0**

## Resultado

El esquema `public` observado contiene tablas del sistema legacy de inauguración, entre ellas:

- `administradores_lihen`
- `control_evento`
- `eventos_sala`
- `ganadores`
- `inventario_premios`
- `juegos`
- `participantes`
- `respuestas`
- `resultados_ruleta`
- `salas`
- `turnos`
- `votos`

No se encontró `public.products`. Por tanto, el inventario de columnas `business_line`, `brand`, `category`, `subcategory`, `brand_id` y `category_id` devolvió cero resultados.

## Decisión

**NO USAR ESTE PROYECTO PARA FASE 1.8.1.**

No se ejecutó ningún DDL, `INSERT`, `UPDATE`, `DELETE`, backfill ni cambio de RLS.

El gate sigue:

`DEV EXECUTION PENDING / TARGET SUPABASE DEV NOT CONNECTED`

## Consecuencia

Los artefactos SQL preparados en `database/migrations/pending/` y los prechecks de `database/validation/` permanecen como especificación no destructiva. No se habilita lectura canónica de `brand_id/category_id` y `SupabaseProductRepository` conserva el contrato legacy de seis campos hasta conectar el DEV correcto.
