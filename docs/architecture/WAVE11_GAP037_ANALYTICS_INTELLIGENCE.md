# WAVE 11 / GAP-037 — Analytics Intelligence

## Classification

BUILD + EXTEND / DELTA-FIRST.

## Recovery point

`14829cfe9a289c521852bed738b2b98c844ff0f0`

## Master scope

`GAP-037 Analytics Intelligence — BUILD/EXTEND. ORDER 37.`

## Audit finding

LIHEN already has an operational Dashboard in Control Center.

The existing Dashboard:

- reads the governed `operational_dashboard_summary`;
- shows product, inventory, order, sales, finance and integrity metrics;
- evaluates metric integrity and operational health;
- presents explainable recommendations;
- remains read-only.

GAP-037 does not create a second dashboard or a second metric authority.

## Delta

GAP-037 adds a transversal Analytics Intelligence capability inside
`@lihen/intelligence-core`.

It consumes a governed `AnalyticsSnapshot` supplied through context.

Each metric may provide:

- current value;
- previous value;
- unit;
- expected minimum;
- expected maximum.

The engine deterministically computes:

- current-value signals;
- absolute delta;
- ratio change when previous value is non-zero;
- expected-range violations.

## Governance

Analytics is analysis, not authority.

The existing Orchestrator requires:

- `intelligence.read_context`;
- `intelligence.analyze`.

Analytics does not read SQL or Supabase directly.

The source application/composition layer remains responsible for obtaining a governed
metric snapshot from canonical read models such as `operational_dashboard_summary`.

Derived signals become `IntelligenceEvidence`.

Only an explicit expected-range violation creates an OPEN
`REVIEW_ANALYTICS_SIGNAL` recommendation requiring human review.

No recommendation executes a correction.

## No fake forecasting

GAP-037 deliberately does not turn two data points into a forecast.

Delta and ratio change are descriptive deterministic analytics.

Predictive forecasting would require a separately governed model, source history,
validation method and acceptance criteria. None are authorized by GAP-037.

## Explicit non-goals

- No new dashboard UI.
- No Supabase migration.
- No new metric table/view.
- No direct SQL.
- No provider SDK.
- No autonomous forecasting.
- No price/inventory/purchase/sale/finance mutation.
- No scheduling.
- No Automation implementation (GAP-038).
- No PROD.

## DoD

- Analytics Intelligence exported from `@lihen/intelligence-core`.
- deterministic current/delta/ratio/range signals exist.
- duplicate metric ids fail closed.
- invalid expected ranges fail closed.
- evidence preserves first-party source traceability.
- range violations create review-only recommendations.
- Orchestrator permission denial prevents analytics execution.
- no persistence query/mutation inside analytics core.
- no Automation implementation.
- unit tests PASS.
- architecture tests PASS.
- intelligence-core typecheck/build PASS.
- lint PASS for authorized TypeScript delta.
- staging contains only authorized GAP-037 paths.
- commit/push on `next-phase`.
- LOCAL HEAD = REMOTE HEAD.
- new recovery point registered.
- master continuity updated + readback.
