# FASE 1.28 — Legacy Inventory & Cash Reconciliation

## Estado

**PASS — CLOSED WITH QUARANTINED IDENTITY EXCEPTIONS**

Fecha de cierre DEV: 2026-08-22.

## Fuente autoritativa

Export READ-ONLY del Supabase histórico LIHEN Admin (`admhxolrhhipwcxbythl`).

- Export: `legacy-export-2026-08-21T23-59-07-819Z`
- Manifest SHA-256: `30718e1668db245a5c62cd37e1acd90767446a20cbe170dc574fd2997a0b7b5a`
- La carpeta local `legacy-export-*` contiene evidencia operacional/financiera y **NO debe versionarse**.

Conteos exportados:

- products: 467
- inventory: 467
- inventory_movements: 221
- quick_sales: 43
- quick_sale_items: 62
- orders: 4
- order_items: 11
- financial_accounts: 2
- financial_movements: 24
- suppliers: 8
- supplier_products: 467
- supplier_requests: 12
- supplier_request_items: 33
- supplier_payments: 10
- product_cost_history: 0

## Integridad de origen

El export fue validado antes de reconciliar:

- hashes del manifest: PASS
- referencias producto → inventario: PASS
- referencias movimientos → inventario: PASS
- referencias venta → productos: PASS
- referencias pedido → productos: PASS
- referencias proveedor → productos: PASS
- no se ejecutaron writes contra el sistema legacy

## Snapshot de inventario legacy

Totales de la fuente:

- físico: 81
- reservado: 3
- pendiente: 7
- disponible: 78

59 identidades tienen saldo físico/reservado/pendiente distinto de cero.

Clasificación conservadora del saldo vivo:

| Estado | Filas | Físico | Reservado | Pendiente |
|---|---:|---:|---:|---:|
| MATCHED | 4 | 8 | 0 | 0 |
| PROBABLE_MATCH | 10 | 11 | 0 | 3 |
| CONFLICT | 14 | 14 | 0 | 2 |
| UNMATCHED | 17 | 20 | 1 | 2 |
| LEGACY_ONLY | 14 | 28 | 2 | 0 |

Solo `MATCHED` se convirtió en opening balance canónico. Ninguna identidad ambigua fue forzada.

Opening balances canónicos aprobados:

- Desmaquillador bifásico / Vive Beauty → 1
- Mantequilla corporal / Vive Beauty → 5
- Lip Gloss Litchi Honey / Destiny → 1
- Lápiz de cejas / Bloomshell → 1

Total `ON_HAND` canónico importado: **8**.

El resto permanece preservado en la corrida de reconciliación y en el export firmado. `LEGACY_ONLY` incluye Style sin contraparte en el Product Master actual y una clasificación histórica incorrecta (p. ej. prenda marcada como Beauty Care). Esta cuarentena evita inventar identidad.

## Finanzas

Se preservaron 24 movimientos financieros legacy y 2 snapshots de cuenta. El contrato conserva:

- estado legacy
- identidad de origen
- reversión
- exclusión de reporting
- balance_before
- balance_after
- canal/cuenta legacy

Saldos finales verificados:

- efectivo: COP 208,600
- nequi: COP 438,550

El último `balance_after` de cada cuenta coincide exactamente con su snapshot legacy.

## Reglas de seguridad

- ledgers inmutables; correcciones mediante asiento compensatorio
- tablas legacy en `lihen_private`
- `public.inventory_movements` con RLS + deny explícito para anon/authenticated
- solo `service_role` puede insertar evidencia/cutover
- ningún stock ambiguo cambia Product Master, precio o visibilidad
- `visible_on_website` continúa false
- `main_image_url` continúa NULL

## Resultado

La reconciliación está completa aunque no todas las identidades estén canónicamente resueltas. Las excepciones quedan explícitas y sin pérdida de evidencia. Esto permite cerrar 1.28 sin contaminar el Product Master.
