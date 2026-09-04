# WAVE 12 / GAP-039 — Unified Intelligence Audit

## Classification

EXTEND transversal / READ MODEL / DELTA-FIRST.

## Recovery point

`594329d176309f2afd31cf7a9d44b0cbc8472249`

## Master scope

`GAP-039 Unified Intelligence Audit — EXTEND transversal.`

## Audit finding

LIHEN already has audit-relevant authority distributed across existing components:

- Orchestrator permission decisions;
- executed Intelligence capabilities;
- Intelligence evidence, candidates and recommendations;
- explicit human decisions;
- Unified Human Review Queue as a projection/read model;
- Existing Control Plane audit timeline.

The system therefore does not need a second audit authority.

## Delta

GAP-039 adds a unified read-model normalizer inside `@lihen/intelligence-core`.

It can normalize:

1. Intelligence request;
2. permission decisions;
3. capabilities executed;
4. evidence created;
5. candidates created;
6. recommendations created;
7. Intelligence result;
8. human decision;
9. Control Plane audit event.

Every normalized event carries:

- event id;
- correlation id;
- event kind;
- source authority label;
- occurrence time;
- optional actor/capability/subject/status;
- source payload.

## Correlation

The primary transversal key is `correlationId`.

Orchestrator-produced objects must match the request correlation id or normalization
fails closed.

Control Plane events retain their own original audit record. The composition layer
binds the known correlation id when projecting that source event into the unified view.

This binding does not rewrite the Control Plane source record.

## Source ownership

Unified Intelligence Audit is a projection.

Sources remain authoritative for their own records:

- Orchestrator for Intelligence execution results;
- source-specific human decision path for decisions;
- Existing Control Plane for controlled-operation audit events.

No audit record is migrated or duplicated into a new persistence authority.

## AUDIT_INTELLIGENCE

The existing `AUDIT_INTELLIGENCE` capability can consume a governed audit snapshot
and return deterministic summary evidence.

It remains read-only.

## Explicit non-goals

- No Supabase migration.
- No new audit table.
- No new decision store.
- No audit record mutation.
- No Control Plane confirmation.
- No RLS changes (GAP-040).
- No idempotency layer (GAP-041).
- No telemetry/observability stack (GAP-042).
- No PROD.

## DoD

- Unified Intelligence Audit exported from `@lihen/intelligence-core`.
- Orchestrator, human decision and Control Plane events normalize into one model.
- source authority labels are preserved.
- correlation mismatches fail closed.
- duplicate unified event ids fail closed.
- event ordering is deterministic by occurrence time + event id.
- `AUDIT_INTELLIGENCE` remains permission-gated.
- audit summary creates evidence only.
- no candidates/recommendations/mutations are created by audit summary.
- no new persistence authority.
- unit tests PASS.
- architecture tests PASS.
- intelligence-core typecheck/build PASS.
- lint PASS for authorized TypeScript delta.
- staging contains only authorized GAP-039 paths.
- commit/push on `next-phase`.
- LOCAL HEAD = REMOTE HEAD.
- new recovery point registered.
- master continuity updated + readback.
