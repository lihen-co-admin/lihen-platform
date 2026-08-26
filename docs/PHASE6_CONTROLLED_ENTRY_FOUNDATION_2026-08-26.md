# FASE 6 — Controlled Entry Foundation

Fecha: 2026-08-26

## Estado de entrada

`FASE 6.0 CONTROLLED ENTRY: PASS` en DEV.

FASE 6 se abre únicamente después del cierre técnico de FASE 5. Este corte no
implementa aún una nueva capacidad comercial; establece el contrato de entrada,
los límites y los invariantes que deben respetar los siguientes subgates.

## Objetivo de FASE 6

Llevar la plataforma desde una base técnicamente validada hacia una operación
administrativa y comercial controlada, observable y auditable, sin romper el
Product Master ni convertir deuda progresiva en datos inventados.

## Alcance inicial

1. `CONTROLLED_OPERATIONALIZATION`
   - convertir capacidades ya construidas en flujos operativos controlados;
   - conservar idempotencia, trazabilidad y revisión humana.

2. `ADMIN_WORKFLOWS`
   - consolidar operaciones OWNER/ADMIN desde Control Center;
   - separar lectura, preparación, aprobación y ejecución.

3. `COMMERCIAL_AND_INVENTORY_SAFETY`
   - proteger precio, inventario, compras, pedidos y publicación;
   - mantener históricos y evidencia antes de cualquier mutación relevante.

4. `OBSERVABILITY_AND_AUDITABILITY`
   - gates medibles;
   - resultados reproducibles;
   - operaciones con evidencia y estado explícito.

5. `PROGRESSIVE_MEDIA_ENRICHMENT_WITHOUT_FABRICATION`
   - continuar Media Intelligence como deuda progresiva;
   - no fabricar galerías, fuentes, derechos, variantes ni activos.

## Invariantes de entrada

- `PRODUCT_MASTER_REMAINS_CANONICAL`
- `NO_STYLE_AUTO_PUBLICATION`
- `NO_EXTERNAL_MEDIA_COPY_WITHOUT_RIGHTS`
- `NO_PRODUCTION_WRITES_FROM_PHASE6_ENTRY`
- `PRICE_HISTORY_REMAINS_APPEND_ONLY`
- `HUMAN_REVIEW_REQUIRED_FOR_AMBIGUOUS_IDENTITY`

## Evidencia heredada verificada en DEV

- FASE 5 final closure: `PASS`
- Storefront visible activo: 952
- Visual Intelligence: 14/14 PASS, 0 fallos
- EUGYM Candidate Bridge: 23/23 `EXISTING_MATCH`
- EUGYM candidatos nuevos: 0
- EUGYM review required: 0
- EUGYM rejected: 0
- STYLE activos: 40
- STYLE visibles: 0

## Deuda heredada no bloqueante

FASE 6 no declara resuelto lo que sigue abierto:

- `PHASE5_QAC_MEDIA_GALLERY_ENRICHMENT_PROGRESSIVE`
- `PHASE5_QAC_WEB_DETAIL_ASSETS_PROGRESSIVE`
- `PHASE5_QAC_APPROVED_ENRICHMENT_PROGRESSIVE`
- `STYLE_PUBLICATION_REMAINS_EXPLICITLY_DEFERRED`

Estas líneas pueden continuar dentro de FASE 6 únicamente bajo sus propios gates
y sin convertirse en requisito implícito de publicación.

## Gate 6.0

Se incorpora:

- `lihen_private.phase6_entry_readiness`
- `public.get_phase6_entry_readiness_controlled()`
- registro `phase_code = '6.0'`
- `gate_version = PHASE6_CONTROLLED_ENTRY_V1`

El RPC administrativo exige OWNER/ADMIN activo. La vista privada no se expone a
`anon` ni a `authenticated` directamente.

## Seguridad

- Aplicado y verificado únicamente en DEV.
- Producción no fue tocada.
- No se modificó Product Master.
- No se modificaron precios.
- No se modificó inventario.
- No se modificó media.
- No se modificó visibilidad.
- STYLE sigue oculto.

## Siguiente decisión

Después de versionar este CUT, el trabajo de FASE 6 debe continuar por subgates
pequeños y explícitos. No debe abrirse una mutación amplia de producción ni
mezclarse la deuda heredada con nuevos requisitos sin un gate específico.
