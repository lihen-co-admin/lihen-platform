# LIHEN Platform — Truth & Architecture Baseline

Fecha efectiva: 2026-08-27
Fuente de trabajo: `LIHEN_PLATFORM_TANDA1_ADMIN_FOUNDATION_CUT1_FINAL_2026-08-27.zip`
Entorno DB verificado: Supabase DEV `vnmkupzptujtywnnabkp`
Producción: fuera de alcance / NO WRITE

## 1. Propósito

Fijar una verdad técnica verificable antes de continuar el cierre de LIHEN Control Center. Este baseline no reconstruye el proyecto desde memoria: inventaría el código entregado, sus módulos, contratos, flags, límites de arquitectura y estado observable de DEV.

El estándar rector de continuidad queda definido como:

1. Fundamentos Generation / Guías Visuales: claridad, lógica, funciones, objetos, APIs, SQL y capas.
2. Diseño mantenible / Refactoring.Guru: responsabilidades claras, bajo acoplamiento, reutilización y patrones solo cuando resuelven un problema real.
3. Invariantes LIHEN: Product Master canónico, trazabilidad, RLS, append-only, idempotencia, governance, snapshots y UX/identidad coherente.

## 2. Baseline ejecutivo

### Confirmado sólido

- Monorepo pnpm con `apps/*`, `packages/*` y `tooling/*`.
- Control Center separado del Storefront.
- Paquetes de dominio independientes para products, suppliers, procurement, inventory, orders, sales, finance, catalog y public-hub.
- Products, suppliers, procurement, inventory, orders y public-hub muestran separación explícita `domain / application / infrastructure / ports` cuando aplica.
- Existen tests de fronteras arquitectónicas que impiden dependencias indebidas relevantes.
- El Control Center usa una capa `composition/*` en lugar de importar persistencia directamente desde páginas.
- Operaciones sensibles usan RPC/commands controlados y feature flags.
- Product Master separa actualización general, cambio de precio e imágenes.
- La ejecución final permanece bloqueada por diseño.

### Confirmado en Supabase DEV

Lecturas no destructivas realizadas el 2026-08-27:

- `8.7` = PASS.
- `QA-C` = PASS.
- `QA-D` = PASS.
- `QA-E` = PASS.
- `QA-CDE` = PASS.
- `public`: 29 tablas, todas con RLS habilitado.
- `lihen_private`: 98 tablas; 15 reportan RLS habilitado (el resto debe interpretarse según su exposición/uso privado, no como hallazgo automático de vulnerabilidad).
- 112 funciones en `public` y 24 en `lihen_private`.
- La RPC corta `get_cc_release_auth_guard_controlled()` existe en DEV.

## 3. Inventario de superficies del Control Center

Rutas confirmadas:

- `/` Dashboard
- `/products` Productos
- `/products/new` Crear producto
- `/products/:id` Detalle de producto
- `/products/:id/edit` Editar producto
- `/products/:id/price` Cambiar precio
- `/products/:id/images` Imágenes
- `/inventory` Inventario
- `/suppliers` Proveedores
- `/purchases` Compras
- `/purchases/:id` Detalle de compra
- `/orders` Pedidos
- `/sales` Ventas / POS
- `/finance` Caja y finanzas
- `/operations` Integridad y auditoría
- `/catalogs` Catálogos
- `/catalogs/content` Contenido institucional
- `/catalogs/:id/render` Render PDF
- `/content/public-hub` Hub público
- `/brands` Marcas
- `/categories` Categorías
- `/dev-auth-probe` Herramienta DEV de Auth/Profile/RLS/Cutover

## 4. Mapa de dependencias de dominio

```text
Auth / RLS / Roles
        ↓
Brands ─────┐
Categories ─┼──→ Product Master ──→ Pricing / Media / Publication readiness
             │          │
             │          ├──→ Supplier / Procurement ──→ Inventory ledger
             │          │                              ↑        ↓
             │          └──→ Orders ──→ Reservations ──┘        │
             │                          ↓                        │
             │                         Sales / POS ──────────────┤
             │                          ↓                        │
             └──────────────────────→ Finance ledger ←───────────┘

Product Master + eligibility + media + price
        ↓
Snapshots / Catalogs ──→ PDF / Storefront
        ↓
Public Hub

All controlled domains
        ↓
Integrity / Audit / Governance
        ↓
Read-only LIHEN Intelligence signals
        ↓
Dashboard / contextual recommendations
```

## 5. Feature flags — estado y drift de configuración

Flags usados por Control Center:

- `VITE_AUTH_MODE`
- `VITE_DEV_ALLOW_BOOTSTRAP_SIGNUP`
- `VITE_PRODUCT_READ_SOURCE`
- `VITE_PRODUCT_WRITE_MODE`
- `VITE_PRODUCT_UPDATE_WRITE_MODE`
- `VITE_PRODUCT_PRICE_WRITE_MODE`
- `VITE_PRODUCT_PRICE_HISTORY_READ_MODE`
- `VITE_PRODUCT_IMAGES_READ_MODE`
- `VITE_PRODUCT_IMAGE_WRITE_MODE`
- `VITE_SUPPLIER_WRITE_MODE`
- `VITE_PURCHASE_WRITE_MODE`
- `VITE_ORDER_WRITE_MODE`
- `VITE_INVENTORY_WRITE_MODE`
- `VITE_SALE_WRITE_MODE`
- `VITE_FINANCE_WRITE_MODE`
- `VITE_PUBLIC_HUB_MODE`
- `VITE_VISUAL_INTELLIGENCE_MODE`

### GAP TA-ENV-001 — `.env.example` incompleto

Ocho flags usados por el código no están documentados actualmente en `.env.example`:

- `VITE_FINANCE_WRITE_MODE`
- `VITE_INVENTORY_WRITE_MODE`
- `VITE_ORDER_WRITE_MODE`
- `VITE_PRODUCT_IMAGE_WRITE_MODE`
- `VITE_PRODUCT_UPDATE_WRITE_MODE`
- `VITE_PURCHASE_WRITE_MODE`
- `VITE_SALE_WRITE_MODE`
- `VITE_SUPPLIER_WRITE_MODE`

Se clasifica **P1 / configuration contract drift**. Debe corregirse antes de considerar el baseline de configuración cerrado.

## 6. Contratos RPC y límite PostgreSQL

### RESUELTO TA-RPC-001 — release authorization guard

El nombre original superaba el límite seguro de identificadores PostgreSQL y se materializó truncado. La TANDA 1 introdujo la RPC corta:

`get_cc_release_auth_guard_controlled()`

El contrato corto está confirmado en DEV.

### NUEVO HALLAZGO TA-RPC-002 — RPC 8.7 también excede 63 caracteres

El frontend llama:

`get_phase8_7_release_governance_hardening_closure_readiness_controlled`

Longitud observada en código: 70 caracteres.

PostgreSQL registra actualmente:

`get_phase8_7_release_governance_hardening_closure_readiness_con`

con longitud 63.

Esto es **P0/P1 de contrato UI↔DB** porque puede provocar el mismo fallo de schema cache cuando Operations intente consumir el nombre largo. El gate 8.7 está PASS en la tabla de resultados; el hallazgo afecta el contrato de lectura del Control Center, no invalida el gate.

### Guardrail requerido

Agregar una prueba/validador que falle si una RPC pública nueva supera un umbral seguro de nombre (recomendado <= 60 caracteres) y usar aliases cortos estables para contratos de UI.

## 7. Fronteras arquitectónicas

El test `tests/architecture/boundaries.test.ts` confirma actualmente:

- packages no importan apps;
- product domain no depende de React/Supabase;
- core no depende de React/Supabase;
- supplier/procurement/inventory/catalog/public-hub domain no depende de React/Supabase;
- shared no depende de dominios de negocio seleccionados;
- storefront no importa dominios administrativos privados seleccionados;
- páginas de Control Center no importan adaptadores de persistencia directamente.

### GAP TA-ARCH-001 — cobertura parcial de dominios

El guard actual no cubre explícitamente `orders`, `sales` y `finance` con la misma regla de independencia React/Supabase aplicada a otros domains.

Clasificación: **P1 de arquitectura preventiva**, no evidencia de violación actual.

Recomendación: extender el test para esos dominios y mantener el principio uniforme.

## 8. Drift de tipos generados

`packages/database/src/generated/database.types.ts` declara en su cabecera haber sido generado tras la foundation FASE 1.17 y no contiene el contrato de la nueva RPC corta.

### GAP TA-TYPES-001

Los tipos generados de DB no representan íntegramente la superficie actual de DEV.

Clasificación: **P1**. Deben regenerarse en un corte controlado o debe documentarse explícitamente qué contratos están tipados manualmente y por qué.

## 9. Deuda de UX / copy técnico detectada

Varias páginas todavía presentan fases históricas como mensaje principal de usuario:

- Finance: `FASE 2.8 ...`
- Inventory: `FASE 2.4A ...`
- Suppliers: `FASE 2.5A ...`
- Orders: `FASE 2.6A ...`
- Sales: `FASE 2.7A ...`
- Brands/Categories: `FASE 2.2 ...`
- Product Detail/Images: textos FASE 1.x/5.

Además `ChangeProductSalePricePage` conserva copy que afirma que Supabase DEV permanece bloqueado hasta aprobar FASE 1.2.1, aunque el proyecto ya está muy por delante de ese estado.

### GAP TA-UX-001 — copy histórico obsoleto

Las referencias históricas deben conservarse para auditoría/documentación, pero no dominar la experiencia de administración ni contradecir el estado actual.

Clasificación: **P1 UX / P2 técnica**.

## 10. Observación de mantenibilidad

`SalesPage.tsx` y `OrdersPage.tsx` concentran actualmente grandes cantidades de estado, handlers, transformación de datos y markup en un mismo componente. No se declara automáticamente como bug, pero es candidato claro para refactor progresivo conforme el Design System y los application read-models se consoliden.

### GAP TA-REF-001 — riesgo de componentes monolíticos

Criterio rector:

- extraer lógica por responsabilidad;
- no introducir patrones por obligación;
- mantener UI como presentación/orquestación ligera;
- mover reglas de negocio a application/domain;
- reutilizar patrones visuales compartidos.

Clasificación: **P1 mantenibilidad**.

## 11. Definition of Done transversal

Toda tanda futura debe superar cinco filtros:

### A. Fundamentos Generation

- control de flujo legible;
- funciones pequeñas y con propósito;
- tipos/objetos claros;
- APIs y SQL usados mediante contratos coherentes;
- capas respetadas.

### B. Diseño / Refactoring.Guru

- sin duplicación relevante;
- responsabilidades separadas;
- acoplamiento justificado;
- sin mega-componentes evitables;
- patrón aplicado solo si resuelve un problema concreto.

### C. Invariantes LIHEN

- Product Master canónico;
- historial y snapshots preservados;
- RLS/roles respetados;
- append-only donde corresponda;
- idempotencia y operation keys en operaciones sensibles;
- no auto-mutación desde Intelligence;
- no ejecución final accidental.

### D. UX / LIHEN

- Design System compartido;
- loading / empty / error / success / disabled states;
- copy humano y vigente;
- identidad visual coherente;
- accesibilidad básica.

### E. QA

- `git diff --check`;
- `pnpm check` completo;
- tests de regresión relevantes;
- restore de `tsbuildinfo` antes de staging;
- staging únicamente de archivos intencionales.

## 12. Priorización de gaps

| ID | Severidad | Hallazgo | Siguiente acción |
|---|---|---|---|
| TA-RPC-002 | P0/P1 | RPC 8.7 excede límite PostgreSQL y está truncada | crear alias corto + adaptar frontend + test |
| TA-ENV-001 | P1 | 8 flags usados no están en `.env.example` | completar contrato de configuración |
| TA-ARCH-001 | P1 | boundary tests no cubren orders/sales/finance igual que otros domains | ampliar guardrails |
| TA-TYPES-001 | P1 | database types no reflejan superficie actual | regenerar/reconciliar tipos |
| TA-UX-001 | P1 UX | copy histórico/obsoleto domina varias páginas | migrar a copy operativo + metadata técnica secundaria |
| TA-REF-001 | P1 | páginas operativas monolíticas | refactor progresivo con Design System/read models |

## 13. Estado de cierre de Truth & Architecture Baseline

**Estado: PARTIAL PASS — baseline factual establecido, gaps de contrato identificados.**

No se recomienda declarar la Fase 0 completamente cerrada hasta completar como mínimo:

1. corregir TA-RPC-002;
2. documentar flags faltantes (TA-ENV-001);
3. extender boundary tests (TA-ARCH-001);
4. decidir estrategia de regeneración/reconciliación de tipos DB (TA-TYPES-001);
5. reejecutar `pnpm check` sobre el corte final corregido en entorno local.

La siguiente micro-tanda recomendada es **TRUTH BASELINE CLOSURE CUT 1**, limitada a contratos/guardrails y sin cambios de negocio ni execution.

---

## 14. Truth Baseline Closure · CUT 2

### TA-RPC-002 — RESUELTO EN CÓDIGO Y DEV

Se sustituye el contrato frontend excesivamente largo de FASE 8.7 por el alias estable:

`public.get_phase87_release_readiness_controlled()`

El alias replica exactamente las guardas OWNER/ADMIN y retorna la misma vista privada de readiness. No habilita ejecución, dispatch ni canary. Se agrega además un guardrail arquitectónico que falla si Control Center intenta consumir una RPC cuyo identificador excede los 63 bytes de PostgreSQL.

### TA-ENV-001 — RESUELTO

`.env.example` raíz y `apps/control-center/.env.example` documentan ahora el contrato real de capacidades usadas por Control Center, con defaults seguros `blocked`/`disabled`:

- Product create/update/price/history/images;
- Inventory;
- Suppliers;
- Purchases;
- Orders;
- Sales/POS;
- Finance;
- Visual Intelligence;
- Public Hub;
- DEV bootstrap signup.

La configuración de ejemplo no activa ninguna mutación.

### TA-ARCH-001 — RESUELTO

`tests/architecture/boundaries.test.ts` extiende los guardrails React/Supabase a:

- `packages/orders/src/domain`;
- `packages/sales/src/domain`;
- `packages/finance/src/domain`.

También se incorpora el guardrail de longitud de RPC consumida por Control Center.

### TA-TYPES-001 — ESTRATEGIA DEFINIDA

Los tipos generados de Supabase se tratarán como **snapshot derivado de esquema**, no como fuente de verdad editada manualmente.

Regla de continuidad:

1. la fuente de verdad del esquema son migraciones versionadas + DEV aplicado;
2. después de una tanda que cambie contratos públicos de DB/RPC, regenerar `packages/database/src/generated/database.types.ts` desde `vnmkupzptujtywnnabkp` usando el generador oficial de Supabase disponible en el entorno local/CI;
3. revisar el diff generado; no editar a mano para “hacer coincidir” una firma;
4. ejecutar `pnpm check` completo;
5. commitear el snapshot de tipos únicamente junto al cambio de contrato que lo origina;
6. cualquier drift entre migraciones, DEV y tipos generados bloquea el cierre de la tanda.

Hasta disponer del generador oficial autenticado en el entorno de ejecución, el archivo actual se conserva sin falsificar firmas manualmente.

### Estado de Truth & Architecture Baseline después de CUT 2

**READY FOR LOCAL QA**. El alias corto fue aplicado y verificado en Supabase DEV; 8.7 y QA-CDE permanecen PASS. Pendiente únicamente de:

- `git diff --check`;
- `pnpm check`;
- restauración de `tsbuildinfo` antes de staging.

Los gaps `TA-UX-001` y `TA-REF-001` quedan deliberadamente fuera del cierre estructural de Fase 0 y pasan al backlog de Admin Foundation / refactor progresivo. No son blockers del baseline factual.
