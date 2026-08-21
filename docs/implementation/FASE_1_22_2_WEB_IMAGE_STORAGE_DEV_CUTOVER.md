# FASE 1.22.2 — WEB IMAGE STORAGE DEV CUTOVER & PRODUCT IMAGE METADATA

## Estado

`READY — OPERATIONAL CUTOVER PENDING`

La foundation server-side ya está aplicada en Supabase DEV mediante la migración:

`20260821212533_web_image_storage_cutover_foundation.sql`

La foundation no sube archivos. Crea un finalizador idempotente restringido a `service_role` que solo acepta el contrato canónico de esta fase.

## Fuente física

- Manifest: `data/catalog-v1/web-image-storage-upload-dry-run-v1.json`
- Derivados: `data/catalog-v1/web-derivatives-v1/files/*.webp`
- Total esperado: `952`
- Bucket: `lihen-product-web`
- Perfil: `WEB_CARD`
- Source provenance: `CATALOG_EVIDENCE_CROP`
- Publication eligibility source: `FALLBACK_ONLY`
- Asset role: `DERIVATIVE`

## Invariantes antes de ejecutar

El ejecutor detiene el proceso si no se cumple cualquiera de estas condiciones:

- exactamente 952 filas;
- 952 `product_image_id` únicos;
- 952 `product_id` únicos;
- 952 rutas Storage únicas;
- 952 archivos locales presentes;
- hash SHA-256 local = manifest;
- byte size local = manifest;
- MIME = `image/webp`;
- cada archivo <= 3 MiB;
- ruta exacta:
  `products/{product_id}/{product_image_id}/web/{sha256}.webp`.

## Secretos

No guardar secretos en Git ni en archivos `VITE_*`.

El ejecutor solo lee en runtime:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Usar un `.env.local`/terminal local ignorado por Git o el secret store de CI.

## Dry-run

Con Node 24:

```bash
node tooling/cutover-web-images-v1.mjs
```

El modo por defecto es `DRY_RUN`. No requiere Supabase credentials y no hace red.

Debe terminar con:

```text
status = DRY_RUN_PASS
validated_count = 952
```

## Cutover DEV

Solo después del dry-run PASS:

```bash
node tooling/cutover-web-images-v1.mjs --execute
```

Comportamiento por fila:

1. intenta upload con `upsert=false`;
2. si el objeto ya existe, solo acepta replay si los bytes públicos tienen el mismo SHA-256 y tamaño;
3. vuelve a descargar/verificar el objeto;
4. llama `public.finalize_web_image_storage_cutover(...)`;
5. el RPC valida provenance y registra:
   - `public.product_images`;
   - `lihen_private.product_image_storage_assets`;
   - ledger idempotente `lihen_private.web_image_storage_cutover_operations`.

## Lo que 1.22.2 NO hace

- no modifica `products.visible_on_website`;
- no modifica `products.main_image_url`;
- no convierte evidencia en ORIGINAL/OFFICIAL_WEB;
- no sube nada a `lihen-product-originals`;
- no usa browser upload;
- no hace hotlink;
- no hace upsert destructivo de objetos distintos.

## Gate PASS

Para cerrar 1.22.2 deben comprobarse en DEV:

```text
storage.objects(lihen-product-web) = 952
public.product_images WEB_CARD activos = 952
product_image_storage_assets WEB_CARD activos = 952
web_image_storage_cutover_operations = 952
products.visible_on_website = 0
products.main_image_url NOT NULL = 0
```

Además:

- 0 fallos de hash;
- 0 rutas conflictivas;
- 0 metadata conflicts;
- replay completo debe ser idempotente;
- Security Advisor no debe introducir una exposición nueva.
