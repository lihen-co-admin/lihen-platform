# TANDA 2 — Product Master Completion · CUT 3

Fecha de corte: 2026-08-27

## Objetivo

Cerrar la consistencia transversal de Product Master entre marca, categoría, línea de negocio y lifecycle, sin convertir esta evaluación en un atajo de publicación.

## Cambios

### 1. Política determinística de Product Master readiness

Se añadió `evaluateProductMasterReadiness` en `@lihen/products`.

La política separa dos dimensiones:

- `identityStatus`: `READY | INCOMPLETE | INVALID`.
- `lifecycleStatus`: `OFFERABLE | NOT_OFFERABLE`.

Los motivos evaluados son explícitos y auditables:

- `BRAND_REQUIRED`
- `CATEGORY_REQUIRED`
- `BRAND_INACTIVE`
- `CATEGORY_INACTIVE`
- `CATEGORY_BUSINESS_LINE_MISMATCH`

La función **no decide publicación**. Media, pricing, snapshot, catálogo, storefront y gates permanecen separados.

### 2. Product Detail

El detalle ahora contrasta el Product Master con la taxonomía canónica cargada:

- detecta marca o categoría faltante;
- detecta taxonomía inactiva;
- detecta una eventual incompatibilidad categoría ↔ business line;
- expone `Master readiness` y condición de oferta;
- mantiene lifecycle lógico y price history como responsabilidades separadas.

### 3. Create Product

El alta usa la misma política de readiness antes de guardar:

- no inventa taxonomía;
- resume línea, identidad, lifecycle y pendientes;
- mantiene `INACTIVE` como default conservador;
- no confunde Product Master completo con producto publicable.

### 4. Update Product

La edición usa el mismo criterio compartido:

- muestra categorías activas compatibles;
- conserva visible una categoría histórica inactiva ya asignada para no ocultar deuda existente;
- señala visualmente categoría inactiva o incompatible;
- señala marca inactiva;
- business line permanece bloqueada en UI para evitar reclasificaciones accidentales;
- pricing continúa fuera del formulario.

### 5. Tests

Se agregó `packages/products/tests/product-master-readiness.test.ts` con cobertura para:

- identidad completa;
- taxonomía faltante;
- taxonomía inactiva;
- mismatch categoría/business line;
- separación entre master readiness y publication readiness.

## Invariantes preservados

- No DELETE físico de Product Master.
- No publicación automática.
- No writes directos desde LIHEN Intelligence.
- No cambios a PROD.
- No bypass de RLS, comandos controlados, operation keys ni governance.
- `Product Master readiness != publication readiness`.

## Estado del corte

Implementación preparada para checkpoint local:

```bash
git diff --check
pnpm check
git status
```

El CUT solo puede declararse PASS después de ese checkpoint local.
