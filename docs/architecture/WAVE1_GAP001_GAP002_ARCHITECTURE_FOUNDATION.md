# LIHEN WAVE 1 — GAP-001 + GAP-002
## Architecture Foundation V1

**Estado del paquete:** IMPLEMENTATION FOUNDATION  
**Alcance:** GAP-001 / GAP-002  
**Cambio funcional visible:** 0  
**Migraciones Supabase:** 0  
**Cambios RLS:** 0  
**Cambios PROD:** 0  
**Movimientos masivos de archivos:** 0  

## 1. Propósito

Esta intervención ejecuta la primera parte de WAVE 1 sin reorganizar físicamente el repositorio.
Su objetivo es congelar responsabilidades arquitectónicas, documentar el estado actual y
añadir guardas ejecutables que impidan que la ambigüedad entre Domain, Application,
Composition, Governance e Intelligence crezca mientras se realiza la consolidación.

No introduce LIHEN Intelligence Core todavía. Ese trabajo empieza en GAP-003.

## 2. Clasificación de responsabilidades

### BUSINESS DOMAIN

Fuente canónica de invariantes de negocio.

Ubicación objetivo:
- `packages/products/src/domain`
- `packages/catalog/src/domain`
- `packages/inventory/src/domain`
- `packages/suppliers/src/domain`
- `packages/procurement/src/domain`
- `packages/orders/src/domain`
- `packages/sales/src/domain`
- `packages/finance/src/domain`
- `packages/public-hub/src/domain`
- dominios equivalentes existentes o futuros dentro de `packages/*/src/domain`

Reglas:
- no React;
- no Supabase directo;
- no pages del Control Center;
- no composition del Control Center;
- no adapters concretos de proveedores externos;
- mantiene invariantes y lenguaje de negocio.

### APPLICATION

Coordina casos de uso y handlers. Puede depender de Domain y Ports.
No contiene componentes React ni decide detalles de infraestructura visual.

Ejemplo de referencia existente:
`packages/products/src/application`.

### INFRASTRUCTURE

Implementa repositories, adapters, Supabase, Storage, APIs externas y otros detalles técnicos.

Ubicación preferida:
`packages/*/src/infrastructure` y adapters específicos de infraestructura.

### PRESENTATION

UI, routing, pages, components, styles y renderers.

Ubicaciones actuales:
- `apps/control-center/src/pages`
- `apps/control-center/src/components`
- `apps/control-center/src/styles`

Presentation puede solicitar casos de uso, pero no debe importar adapters de persistencia
directamente ni convertirse en fuente de verdad.

### COMPOSITION

Composition es **assembly boundary**, no dominio alterno.

Responsabilidades permitidas:
- dependency wiring;
- repository selection;
- handler assembly;
- application facade construction;
- environment configuration;
- adaptación mínima de dependencias para la aplicación.

Responsabilidades que NO deben agregarse nuevas dentro de Composition:
- nuevas invariantes de negocio;
- nuevas políticas canónicas de assets;
- nuevas reglas de Intelligence;
- nuevos motores de recomendación;
- nuevos modelos de riesgo/autorización;
- nuevas decisiones editoriales de catálogo;
- lógica de verificación de marca/producto;
- mutaciones directas desde UI.

### POLICY / GOVERNANCE

Responsabilidad objetivo:
- permisos;
- riesgo;
- confirmation/release guards;
- readiness;
- control-plane rules;
- validación de acciones gobernadas.

La foundation actual de Operations/controlled operations se conserva.
No se crea un segundo command engine.

### INTELLIGENCE

Responsabilidad objetivo, a crear desde GAP-003:
- orchestrator;
- context resolution;
- evidence;
- candidates;
- recommendations;
- assurance;
- provider/tool abstraction;
- capabilities de análisis/búsqueda/verificación.

Ubicación física definitiva se decidirá al implementar GAP-003, siguiendo el modular-monolith
existente. La dirección preferida continúa siendo paquetes explícitos como
`packages/intelligence-core` y `packages/intelligence-capabilities`, sin obligar este paquete
a crearlos prematuramente.

## 3. Inventario de responsabilidades actuales

### `packages/*`

**Clasificación:** backbone modular que se conserva.

La estructura actual ya separa dominios como Products, Catalog, Inventory, Suppliers,
Procurement, Orders, Sales, Finance, Public Hub y otros. No se reconstruyen por WAVE 1.

### `apps/control-center/src/domain`

**Clasificación actual:** legacy/mixed application semantics.

Contiene reglas que no son todas Business Domain en sentido canónico. Entre las familias
observadas están:
- dashboard/intelligence;
- dashboard health/integrity/focus;
- governance evidence;
- governance operation policy;
- governance readiness;
- intelligence assurance;
- DEV activation/pilot/readiness;
- commerce readiness/reconciliation;
- admin experience/surface semantics.

**Decisión WAVE 1:** no moverlas todavía. Se congelan como deuda de clasificación.
Nuevas responsabilidades de estas familias no deben seguir acumulándose bajo un nombre
`domain` ambiguo.

### `apps/control-center/src/composition`

**Clasificación actual:** assembly + facades + acumulación histórica de políticas.

Se conservan compositions de productos, catálogo, operaciones, inventario, finanzas,
pedidos, procurement e institucional. También existen piezas STYLE/editoriales que
deben formalizarse posteriormente en Catalog Policy/Composer.

**Decisión WAVE 1:** no moverlas todavía. A partir de este punto Composition no recibe
nuevos motores de reglas canónicas.

### `apps/control-center/src/pages`

**Clasificación:** Presentation.

La regla vigente continúa: las pages no importan adapters de persistencia directamente.

## 4. Dependencias permitidas

Dirección conceptual:

`Presentation → Application/Composition → Domain/Ports → Infrastructure`

Para Intelligence, a partir de GAP-003:

`Presentation/Application → Intelligence Orchestrator → Capabilities/Ports → Infrastructure`

Para mutaciones gobernadas:

`Intelligence Recommendation → Human Decision → Existing Control Plane → Domain/RPC → Audit`

## 5. Dependencias prohibidas

- `packages/*` → `apps/*`
- business domain → React
- business domain → Supabase
- Control Center domain semantics → pages/components/styles
- Control Center domain semantics → composition
- new canonical policies → composition
- renderer → canonical identity/asset decision
- Intelligence → direct DB mutation
- Assistant → bypass RLS
- new command engine paralelo al control plane actual

## 6. Regla transitoria para código existente

WAVE 1 **no rompe código histórico por ubicación**.

La regla es:
1. preservar comportamiento;
2. bloquear nueva deuda;
3. documentar componentes ambiguos;
4. extraer responsabilidades de forma incremental cuando el GAP correspondiente lo exija;
5. no realizar mudanzas masivas sólo para “ordenar carpetas”.

## 7. Guardas ejecutables incluidas

`tests/architecture/control-center-layering.test.ts` añade guardas para:
- evitar que `apps/control-center/src/domain` dependa de Presentation;
- evitar que `apps/control-center/src/domain` dependa de Composition;
- evitar persistencia directa desde `apps/control-center/src/domain`;
- evitar que Composition dependa de Presentation;
- asegurar que los targets futuros de Intelligence/Policy/Governance, si aparecen, no dependan de Presentation.

Las guardas existentes de `tests/architecture/boundaries.test.ts` se conservan intactas.

## 8. Estado de GAP-001 y GAP-002 después de aplicar este paquete

### GAP-001 — Normalizar fronteras arquitectónicas

Estado esperado tras aplicar y validar: **IMPLEMENTED FOUNDATION / PARTIAL**.

Cierra:
- clasificación;
- reglas;
- dependencias;
- guardas contra nueva deuda.

Permanece para cierre total:
- reubicar gradualmente responsabilidades legacy sólo cuando sea necesario y probado.

### GAP-002 — Adelgazar Composition Layer

Estado esperado tras aplicar y validar: **IMPLEMENTED FOUNDATION / PARTIAL**.

Cierra:
- contrato de Composition;
- prohibición de nueva lógica canónica;
- guardas contra dependencia a Presentation.

Permanece para cierre total:
- extraer policies/editorial/intelligence existentes en los GAPs que correspondan sin modificar comportamiento prematuramente.

No se declararán `DONE` hasta que la auditoría de referencias confirme que la deuda
legacy restante ha sido clasificada o extraída de acuerdo con la Master Specification.

## 9. Validación requerida

Ejecutar:

```bash
pnpm test:architecture
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Preferido para cierre completo del quality gate:

```bash
pnpm check
```

## 10. Definition of Done de esta intervención

- documentación instalada;
- architecture tests instalados;
- `pnpm test:architecture` PASS;
- `pnpm check` PASS;
- cero cambio funcional;
- cero migración;
- cero RLS;
- cero PROD;
- no se modifican archivos históricos de CUT9;
- no se realiza limpieza destructiva;
- recovery point/commit sólo después de validar.

## 11. Siguiente GAP

Después de validar esta foundation, el siguiente bloque es:

`GAP-003 — Intelligence Core Contracts`

No iniciar GAP-003 hasta tener resultado PASS de WAVE 1 foundation.
