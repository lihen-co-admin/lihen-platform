# FASE 4.11 — Contenido institucional configurable y QR derivados

Estado: implementado en DEV, pendiente de validación local con `pnpm check`.

## Objetivo

Separar el contenido institucional del catálogo del Product Master y permitir que textos,
fotografías, canales y medios de pago cambien sin editar el renderer.

## Flujo

Configuración institucional editable
→ captura explícita en una versión DRAFT
→ snapshot institucional por versión
→ validación
→ ACTIVE
→ renderer PDF

Las versiones ACTIVE anteriores al contrato 4.11 mantienen compatibilidad histórica.

## Seguridad

- tablas institucionales con RLS y sin acceso directo para `authenticated`;
- lectura/escritura por RPC SECURITY DEFINER controlados;
- escritura solo OWNER/ADMIN;
- bucket `catalog-assets` limitado a imágenes y OWNER/ADMIN;
- Edge Function `catalog-qr` con JWT obligatorio;
- ninguna página React accede directamente a Supabase.

## QR

Los links/payloads son el dato fuente. El QR se genera internamente mediante `catalog-qr`.
Los QR de canales cambian al cambiar el link de la configuración y crear/capturar una nueva versión.
Un QR bancario que no sea reconstruible por URL puede configurarse como imagen administrada.

## Orden PDF para versiones con snapshot institucional

1. Portada fija aprobada.
2. ¿Quiénes somos? configurable.
3. Información importante de compra configurable.
4. Medios de pago configurables.
5. Marcas destacadas y productos.
6. `CONECTA CON LIHEN` siempre como última página.

## Regla de inmutabilidad

Editar la configuración institucional actual nunca altera una versión ACTIVE.
Una versión DRAFT debe ejecutar `capture_catalog_institutional_snapshot_controlled`
antes de poder pasar la validación y ser activada.
