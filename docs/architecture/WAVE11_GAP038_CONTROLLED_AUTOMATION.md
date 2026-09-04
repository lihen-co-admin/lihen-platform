# WAVE 11 / GAP-038 — Controlled Automation

## Classification

BUILD LATER / CONTROLLED FOUNDATION / DELTA-FIRST.

## Recovery point

`257b9b8869c4a324b6432f6fe2c17a7089e8d4ee`

## Master scope

`GAP-038 Controlled Automation — BUILD LATER, sin bypass de aprobación. ORDER 38.`

## Audit finding

LIHEN already has:

- `AUTOMATION` as an Intelligence capability;
- `intelligence.prepare_action` as its Orchestrator permission;
- Intelligence autonomy limited to READ / ANALYZE / PROPOSE;
- the existing Control Plane handoff from approved recommendations;
- explicit confirmation separated from preparation.

GAP-038 must preserve those controls.

## Delta

GAP-038 adds a controlled automation planning capability.

An automation plan declares:

- automation id;
- title and purpose;
- trigger kind and source;
- controlled operation code;
- controlled operation key;
- proposed request payload;
- `approvalMode = ALWAYS_REQUIRED`;
- enabled/disabled state.

Supported trigger declarations are descriptive only:

- MANUAL
- EVENT
- CONDITION
- TIME_WINDOW

No trigger runtime is implemented.

## Required governed path

Automation plan
→ Orchestrator permission (`intelligence.prepare_action`)
→ review recommendation
→ explicit human Decision(APPROVE)
→ existing Control Plane validation/preparation
→ explicit confirmation remains separate.

The Automation capability does not call confirmation.

## Why BUILD LATER matters

ORDER 38 creates the safe foundation, not an autonomous runtime.

A real scheduler/worker would introduce operational execution concerns that require
the later hardening gaps, especially:

- GAP-039 Audit;
- GAP-040 RLS;
- GAP-041 Idempotency;
- GAP-042 Observability;
- GAP-043 Quality Gate;
- GAP-044 Production Readiness.

Therefore GAP-038 deliberately stops at governed planning and preparation.

## Explicit non-goals

- No cron.
- No recurring worker.
- No background scheduler.
- No queue.
- No autonomous Control Plane confirmation.
- No direct domain mutation.
- No Supabase migration.
- No RLS changes.
- No new idempotency store.
- No notification delivery engine.
- No PROD.

## DoD

- Controlled Automation exported from `@lihen/intelligence-core`.
- automation plans require `ALWAYS_REQUIRED`.
- approval bypass fails closed.
- Orchestrator requires `intelligence.prepare_action`.
- plan output is a human-review recommendation.
- rejected human decision prevents Control Plane preparation.
- approved human decision may prepare through the existing Control Plane.
- Automation never confirms automatically.
- no scheduler/worker/queue implementation.
- no new idempotency layer.
- unit tests PASS.
- architecture tests PASS.
- intelligence-core typecheck/build PASS.
- lint PASS for authorized TypeScript delta.
- staging contains only authorized GAP-038 paths.
- commit/push on `next-phase`.
- LOCAL HEAD = REMOTE HEAD.
- new recovery point registered.
- master continuity updated + readback.
