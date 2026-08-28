# TANDA 14 — QA Consolidation Reporter
Fecha: 2026-08-28

## Purpose
Preserve the correct test structure (many tests per file) while providing one
complete, domain-oriented quality gate.

The reporter is dynamic. It does not hard-code 96/392, 97/396, or any future
count. It reads Vitest's JSON result on every run.

## One command
After installation:

```bash
pnpm check
```

The command runs:
1. typecheck;
2. lint;
3. the full Vitest suite;
4. build;
5. consolidated domain matrix;
6. complete individual-test traceability.

## Output
The terminal ends with a compact gate:

```text
LIHEN PLATFORM QUALITY GATE
===========================
PRODUCT MASTER         x/x PASS
INVENTORY              x/x PASS
SUPPLIERS              x/x PASS
...
ARCHITECTURE          16/16 PASS
---------------------------
Test Files:          x/x PASS
Tests:               x/x PASS
Architecture:      16/16 PASS
Traceability:        x/x IDENTIFIED
Typecheck:              PASS
Lint:                   PASS
Build:                  PASS

FINAL RESULT:            PASS
```

## Full report
A Markdown and JSON traceability report are written to the operating system's
temporary directory under:

`lihen-platform-quality-gate/`

These generated runtime reports are intentionally outside the repository and do
not pollute Git status.

## Domain classification
Every executed test is assigned deterministically by repository path/test name:
Product Master, Inventory, Suppliers, Procurement, Orders, Sales, Finance,
Catalog, Publishing, Governance, DEV Activation, Intelligence, Storefront,
Public Hub, Control Center, Platform Foundation, or Architecture.

There is no numerical scoring or invented quality threshold. PASS comes from the
real commands and real test statuses.

## Safety
This reporter:
- does not change application business state;
- does not change `.env`;
- does not call Supabase directly;
- does not apply migrations;
- does not enable controlled writes;
- does not enable dispatch/canary/final release;
- does not touch PROD.
