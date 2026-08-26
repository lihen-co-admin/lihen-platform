# FASE 5 — Public Hub Administrable — Checkpoint de entrada

Fecha: 2026-08-26

## A. CURRENT STATE

### VERIFICADO
- FASE 5 activa; Storefront, QA comercial, Product Detail, Media Intelligence y Lens Mode ya existen en el repositorio.
- Lens Mode quedó integrado al Control Center y aislado del Product Master.
- Control Center usa React Router, una `composition` por capability y RPC controladas hacia Supabase.
- Las páginas del Control Center están protegidas por autenticación y los writes sensibles usan OWNER/ADMIN.
- Storefront usa routing por `location.hash`; por compatibilidad de deployment el Hub debe incorporarse en ese router y no abrir una estrategia paralela.
- Storefront obtiene datos públicos mediante RPC y no importa dominios administrativos.
- `public.products` sigue siendo Product Master; no debe duplicarse información canónica en el Hub.
- Existe auditoría operativa central en `public.operational_audit_log`.
- Existen buckets de producto e institucionales; no se requiere un bucket nuevo para la primera versión del Hub.

### INFERIDO
- La ruta pública inicial técnicamente segura es `#descubre` por el routing real existente.
- Los assets editoriales del Hub pueden reutilizar `catalog-assets` en un corte posterior, si se confirma que las políticas/lifecycle son adecuados.
- La primera versión no necesita drag & drop: controles accesibles de subir/bajar posición reducen riesgo y permiten persistencia atómica.

### PROPUESTO
- Introducir capability `@lihen/public-hub` separada de Catalog y Visual Intelligence.
- Persistir bloques administrativos en `lihen_private.public_hub_blocks`.
- Exponer exclusivamente RPC controladas para administración y una proyección pública read-only.
- Estados únicos: `DRAFT | PUBLISHED | HIDDEN | ARCHIVED`.
- Tipos iniciales: `LINK | SOCIAL | PRODUCT | PRODUCT_COLLECTION | BANNER | TEXT | HEADING | CTA`.
- No borrar físicamente por defecto; archivar.

## B. GAP ANALYSIS

| Necesidad | Existe | Reutilizar | Falta | Acción |
| --- | --- | --- | --- | --- |
| Auth OWNER/ADMIN | Sí | `profiles` + RPC controladas | No | Reutilizar |
| Product Master | Sí | `public.products` + proyección storefront | No | Referenciar por `product_id` |
| Auditoría | Sí | `operational_audit_log` | Eventos Hub | Registrar writes Hub |
| Public projection | Parcial | patrón `get_storefront_*_controlled` | RPC Hub | Crear `get_public_hub_controlled` |
| Control Center | Sí | AppShell, routes, composition | Página Hub | Añadir capability |
| Storefront routing | Sí | hash router | ruta Hub | Añadir `#descubre` |
| Scheduling | No en Hub | timestamptz | starts_at/ends_at | Persistir y filtrar en RPC pública |
| Ordering | No en Hub | patrón sort_order | operación atómica | Añadir reorder controlado |
| Storage editorial | Sí parcialmente | `catalog-assets` | confirmación de uso | No crear bucket ahora |
| Analytics | No | — | fuera de alcance inicial | Preparar, no implementar |

## C. ARQUITECTURA

```text
Control Center
  ↓
composition/public-hub
  ↓
@lihen/public-hub application
  ↓
@lihen/public-hub domain
  ↓
repository port
  ↓
Supabase adapter
  ↓
controlled RPC
  ↓
lihen_private.public_hub_blocks

lihen_private.public_hub_blocks
  ↓
get_public_hub_controlled()
  ↓
Storefront Public Hub (#descubre)
```

## D. MODELO DE DATOS MÍNIMO

`lihen_private.public_hub_blocks`
- id
- block_type
- status
- sort_order
- product_id (FK canónica, nullable)
- collection_key (nullable)
- title / subtitle / body
- cta_label
- target_url
- image_url
- starts_at / ends_at
- created_by / updated_by
- created_at / updated_at / archived_at

No se usa JSONB como contenedor genérico del contenido.

## E. RLS / RPC

- Sin acceso directo anon/authenticated a tabla administrativa.
- Admin read/write: OWNER/ADMIN mediante funciones `SECURITY DEFINER` y `search_path=''`.
- Public read: `get_public_hub_controlled()` para anon/authenticated; solo PUBLISHED, vigente y no archivado.
- La proyección de PRODUCT resuelve nombre/precio/slug/media/disponibilidad desde datos canónicos.
- Writes registran auditoría usando `operational_audit_log`.

## F. UX CONTROL CENTER

Ruta propuesta: `/content/public-hub`.

Primera iteración:
- estado visible por bloque;
- crear/editar;
- publicar/ocultar/archivar;
- mover arriba/abajo de forma accesible;
- scheduling opcional;
- preview del destino;
- sin terminología de BD.

## G. UX PUBLIC HUB

Ruta compatible con deployment: `#descubre`.

- mobile first;
- identidad LIHEN;
- encabezado oficial;
- render por tipo de bloque;
- producto canónico con CTA al detalle;
- ocultos/drafts/archivados nunca llegan al cliente.

## H. TEST STRATEGY

- Domain: estados, vigencia, validación por tipo.
- Database: OWNER/ADMIN, anon read, vigencia, drafts ocultos, archive, reorder.
- Control Center: carga, create/edit/status/reorder/empty/error.
- Storefront: `#descubre`, render de publicados, navegación PRODUCT, ocultamiento correcto.
- Architecture: domain sin React/Supabase; pages sin adapters directos.

## I. PLAN DE IMPLEMENTACIÓN

1. Foundation domain + database/RPC.
2. Control Center composition + administración mínima.
3. Storefront projection + `#descubre`.
4. Tests y validación completa.
5. Solo después: assets editoriales, scheduling UX avanzado, preview y refinamientos.

## Gate de entrada

La capability puede iniciar sin romper el gate vigente porque:
- Lens Mode ya quedó cerrado en un commit separado;
- el Hub se implementa como capability separada;
- no cambia Product Master ni catálogo PDF;
- no requiere tocar producción.
