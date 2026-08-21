# FASE 1.20 — Brand & Category Reconciliation Foundation

## Purpose
Reconcile catalog brand/category evidence before any Product Master backfill.

## Authority rules
1. A trusted existing ID has highest authority.
2. Exact unique normalized name may match an existing entity.
3. Medium/low-confidence source labels require review.
4. No fuzzy match can create or select a canonical taxonomy ID automatically.
5. Brand/category evidence does not write public.brands/public.categories.
6. Product backfill remains blocked until taxonomy decisions are approved.

## Catalog V1 dry-run
- 46 brand covers.
- 5 explicit category/section covers.
- DEV Brand Master: 0.
- DEV Category Master: 0.
- 42 high-confidence brands -> NEW_ENTITY candidates.
- 4 brand references -> REVIEW_REQUIRED (3 unresolved logos + Majikal medium confidence).
- 5 explicit categories -> NEW_ENTITY candidates.

## Important
Sections absent from the PDF are not inferred. Product names do not create taxonomy automatically.
