# CORE 14 — Matriz REUTILIZAR / ADAPTAR / ELIMINAR

## Objetivo

Cerrar formalmente el requisito 14 con una decisión verificable sobre los tres proyectos origen:

1. `LIHEN_ADMIN_PRO`
2. `LIHEN_WEB_RENACER`
3. `lihen_intelligence`

Destino canónico: `lihen-platform`.

## Criterios

- **REUTILIZAR**: concepto, evidencia o comportamiento que puede preservarse sin conservar el acoplamiento técnico legacy.
- **ADAPTAR**: comportamiento útil que debe reimplementarse contra los contratos, modelos y seguridad del nuevo Core.
- **ELIMINAR / RETIRAR**: componente que no debe sobrevivir como fuente de verdad o runtime paralelo después del cutover.
- **PRESERVAR COMO EVIDENCIA**: datos o documentos legacy que deben conservarse para trazabilidad, pero no operar como sistema activo.

La matriz no autoriza migraciones automáticas. Toda identidad ambigua permanece en revisión.

---

## 1. LIHEN_ADMIN_PRO

| Área / evidencia legacy | Decisión | Destino / regla |
|---|---|---|
| Productos e inventario | ADAPTAR | Product Master canónico + `@lihen/products` + `@lihen/inventory`. No reutilizar IDs/SKU legacy como identidad canónica sin reconciliación. |
| Repositories JS (`product-repository`, `inventory-repository`, etc.) | ADAPTAR | Conservar responsabilidades, reimplementar como Ports/Adapters TypeScript. No importar módulos JS legacy directamente. |
| Proveedores y compras | ADAPTAR | `@lihen/suppliers` + `@lihen/procurement`. Los 8 proveedores legacy se preservan como evidencia hasta reconciliación explícita. |
| Histórico financiero | PRESERVAR COMO EVIDENCIA | Ledger legacy preservado en tablas privadas. No convertir automáticamente en operaciones nuevas. |
| Event bus / command bus JS | ADAPTAR | Sustituido por contratos `DomainEventBus`, `DomainEventStore`, Strategy/handlers del nuevo Core. |
| Lógica de ventas/pedidos/caja | ADAPTAR DESPUÉS | Migrar por slices posteriores, nunca mediante copia directa de SQL/RPC legacy. |
| SQL legacy 002–048 | PRESERVAR COMO EVIDENCIA | No ejecutar sobre DEV nuevo. Solo usar como fuente de reglas, constraints y casos de prueba. |
| `catalogo_maestro.csv` y plantillas | PRESERVAR / ADAPTAR | Fuente auxiliar de reconciliación/importación; no fuente de verdad runtime. |
| UI HTML/CSS/JS administrativa | ELIMINAR COMO RUNTIME | Funcionalidad útil se reconstruye en `apps/control-center`; no mantener dos paneles administrativos activos. |
| Proyecto Supabase legacy | RETIRAR TRAS CUTOVER | Solo lectura durante transición; no nuevas escrituras una vez cada dominio pase su gate. |

### Decisión global ADMIN_PRO

**ADAPTAR + PRESERVAR EVIDENCIA.** No se reutiliza como runtime final.

---

## 2. LIHEN_WEB_RENACER

| Área / evidencia legacy | Decisión | Destino / regla |
|---|---|---|
| Catálogo público | ADAPTAR | `apps/storefront` debe consumir contratos canónicos y catálogo versionado. |
| Imágenes WebP de producto | REUTILIZAR COMO EVIDENCIA / ASSET | Ya reconciliadas/cutover en storage canónico cuando existe correspondencia segura. |
| `catalogo_maestro.csv`, backups y cruces | PRESERVAR COMO EVIDENCIA | No volver a ser fuente runtime. Se conservan para auditoría/reconciliación. |
| CSS/identidad visual útil | ADAPTAR | Reusar tokens/criterios visuales, no copiar estructura legacy indiscriminadamente. |
| HTML/JS storefront legacy | ELIMINAR COMO RUNTIME | Sustituir por `apps/storefront` en el monorepo. |
| `admin.html` y paneles web legacy | ELIMINAR COMO ADMIN | Toda administración se concentra en `apps/control-center`. |
| Filtros/búsqueda/carruseles | ADAPTAR | Reimplementar con performance medible, paginación/carga controlada y fuente canónica. |
| Páginas legales y contenido institucional | REUTILIZAR / ADAPTAR | Migrar contenido validado; separar contenido de lógica de catálogo. |
| Assets de marca | REUTILIZAR SI ESTÁN APROBADOS | Mantener solo assets oficiales y trazables. |
| GitHub Pages / despliegue legacy | RETIRAR TRAS CUTOVER | Mantener hasta que Storefront nuevo alcance paridad funcional y prueba de rollback. |

### Decisión global WEB_RENACER

**ADAPTAR**, reutilizando assets/evidencias aprobadas. El runtime legacy se retira después del cutover del Storefront.

---

## 3. lihen_intelligence

| Área / evidencia legacy | Decisión | Destino / regla |
|---|---|---|
| Extractor de PDFs/facturas | ADAPTAR | Convertir en adapter/worker de ingestión; nunca escribir directamente Product Master. |
| Scoring/recomendaciones | ADAPTAR | Mantener como inteligencia recomendadora. Toda mutación requiere workflow explícito y aprobación. |
| Market research | ADAPTAR | Servicio/worker separado del dominio transaccional. |
| Exporter | REUTILIZAR CON ADAPTER | Salidas Excel/CSV continúan como artefactos, no como DB maestra. |
| SQLite `data/lihen.db` | ELIMINAR COMO FUENTE DE VERDAD | Preservar backup; no sincronización bidireccional con Supabase. |
| Storage local `uploads/exports` | ADAPTAR | Sustituir por almacenamiento controlado y provenance. |
| Flask/Python UI legacy | RETIRAR COMO UI PRINCIPAL | Puede permanecer como referencia temporal; UX final debe integrarse al Control Center o servicio dedicado. |
| Jobs/scripts de migración SQLite→Postgres | PRESERVAR COMO EVIDENCIA | No ejecutar contra el nuevo Core sin revisión específica. |
| Reglas de decisión automática | ADAPTAR CON STRATEGY | Toda ambigüedad debe producir `REVIEW`, nunca identidad inventada. |

### Decisión global INTELLIGENCE

**ADAPTAR COMO SERVICIO RECOMENDADOR**, desacoplado de las escrituras canónicas.

---

## Reglas transversales de retiro

1. Ningún proyecto legacy conserva autoridad de escritura sobre una entidad después de su cutover.
2. No existe sincronización bidireccional entre legacy y nuevo Core.
3. Los IDs legacy se guardan como referencias externas/evidencia, no reemplazan `product_id` canónico.
4. Evidencia histórica se conserva de forma privada e inmutable.
5. Cada retiro requiere: reconciliación, dry-run, validación, cutover, verify y rollback documentado.
6. No se elimina físicamente un repositorio o base legacy hasta cumplir retención y respaldo.

## Resultado CORE 14

**PASS** — Existe una matriz explícita, trazable y accionable para los tres proyectos origen.
