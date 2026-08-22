# FASE 1.29 — Phase 1 End-to-End Acceptance & Exit Gate

## Estado actual

**BLOCKED — único bloqueo: FASE 1.25 / Supabase leaked-password protection**

## Gate DEV verificado

- Product Master: 952
- BEAUTY_CARE: 952
- STYLE canónico: 0
- WEB_CARD product images ACTIVE: 952
- WEB_CARD storage assets ACTIVE: 952
- web-image cutover operations: 952
- objetos `lihen-product-web`: 952
- productos visibles: 0
- `main_image_url` no nulos: 0
- canonical inventory movements: 4
- canonical ON_HAND: 8
- financial ledger entries legacy: 24
- financial account snapshots: 2
- reconciliation runs CUTOVER: 1
- legacy live balances clasificados: 59

## Seguridad

No se introdujeron regresiones nuevas. El Security Advisor reporta un único WARN:

`auth_leaked_password_protection — Leaked Password Protection Disabled`

Referencia oficial:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Mientras este control siga sin activarse realmente en Supabase, 1.25 no se marca PASS y por contrato 1.29 tampoco puede pasar.

## Performance

El advisor devuelve INFO de índices/FKs históricos y privados. No hay un nuevo warning crítico producido por 1.28. No se eliminan índices solo porque aparezcan como unused en DEV.

## Regla de salida

FASE 2 permanece bloqueada hasta que 1.25 sea PASS o exista una excepción de seguridad explícitamente aprobada y documentada para el entorno DEV. No se interpreta el warning como cerrado automáticamente.
