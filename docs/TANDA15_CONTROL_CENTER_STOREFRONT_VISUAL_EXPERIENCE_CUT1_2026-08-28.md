# TANDA 15 — Control Center + Storefront Visual & Experience Refinement
## CUT 1 — Visual Experience Baseline
Fecha: 2026-08-28

## Goal
Establish the exact local-source baseline before changing any visual layer.

## Dependency rule
TANDA 15 starts from canonical recovery point:

`e63d115e88cb1cbbbfbd29a5ce05c42e678fcfec`

Visual work must not bypass or weaken anything closed in TANDA 14.

## CUT 1
This cut adds:
- a categorical visual-experience readiness policy;
- tests that keep visual work held while source evidence is incomplete;
- a read-only local source auditor for Control Center and Storefront.

The auditor inventories:
- pages;
- shared components;
- styles;
- responsive media queries;
- focus-visible support;
- ARIA usage;
- loading/empty/error states;
- existing status/gate components;
- shared shell/page-hero/table patterns;
- dynamic/lazy-loading signals;
- largest files that may need decomposition.

## Refinement concerns
No numerical quality score is used. Work is organized by:
- visual hierarchy;
- navigation;
- responsive behavior;
- accessibility;
- feedback states;
- perceived performance;
- LIHEN brand consistency.

## Safety
CUT 1 does not:
- alter business/domain logic;
- alter governance;
- alter `.env`;
- call Supabase;
- run migrations;
- enable Supplier browser writes;
- enable dispatch/canary/final execution;
- touch PROD.

The audit tool is transport-only and should be removed after it generates the two
source-audit evidence files.
