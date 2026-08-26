# FASE 5 — Public Hub CUT 2

Fecha: 2026-08-26

## Alcance

Este corte mejora la experiencia administrativa y pública sobre la fundación validada del Public Hub sin crear tablas nuevas ni cambiar Product Master.

## Control Center

- Resumen visible de bloques activos, publicados, programados y archivados.
- Filtros administrativos por estado efectivo.
- Estado efectivo derivado (Borrador, Oculto, Programado, Publicado ahora, Finalizado, Archivado) sin agregar flags persistidos contradictorios.
- Búsqueda local de productos por nombre, marca o SKU antes de seleccionar `product_id`.
- Vista previa resumida del bloque en edición.
- Mensajes de éxito y error después de operaciones.
- Reactivación explícita de archivados como borrador.
- Mejoras de teclado, foco, labels y textos administrativos orientados a negocio.

## Storefront

- Hub público con HTML semántico y navegación accesible.
- Tratamiento visual distinto para PRODUCT, BANNER, SOCIAL y bloques editoriales.
- Disponibilidad de producto visible desde la proyección canónica.
- Enlaces externos con `noopener noreferrer`.
- Estados vacío/error con acción recuperable.
- Soporte `prefers-reduced-motion`.

## Dominio

Se añade `getPublicHubBlockPublicationState` como regla de dominio para derivar el estado efectivo a partir de `status`, `startsAt` y `endsAt`. La UI no replica esta regla mediante flags adicionales.

## Seguridad y persistencia

- Sin nueva migración en CUT 2.
- Sin cambios de RLS/RPC.
- Sin escritura en producción.
- Sin duplicación de producto, precio, inventario o media.
- Los productos del Hub continúan enlazados por `product_id` a Product Master.

## Gate requerido

Ejecutar en el repositorio local:

```bash
git diff --check
pnpm check
git status
```

No declarar PASS hasta que `pnpm check` termine realmente en verde.
