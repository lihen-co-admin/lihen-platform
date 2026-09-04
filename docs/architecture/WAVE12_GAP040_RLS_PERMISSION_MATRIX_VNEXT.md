# WAVE 12 / GAP-040 — RLS & Permission Matrix VNext

## Classification

VALIDATE + HARDEN / EXTEND.

## Recovery point

`d4d6351795dca74091d60b8eb931a306061b44a8`

## Master scope

`GAP-040 RLS & Permission Matrix VNext — VALIDAR antes de nuevas escrituras; CRITICAL.`

## Read-only audit result

The repository audit confirmed:

- tracked SQL migrations exist;
- RLS / policy / `SECURITY DEFINER` controls already exist across multiple domains;
- browser Supabase configuration uses `VITE_SUPABASE_PUBLISHABLE_KEY`;
- service-role material is documented for trusted server/tooling contexts, not browser use;
- operational writes are routed through controlled RPCs;
- write modes are blocked by default;
- Intelligence permission evaluation is default-deny and blocks autonomy outside READ / ANALYZE / PROPOSE;
- the Control Plane preserves explicit human decision + confirmation.

No repository mutation was performed during the audit.

## Decision

GAP-040 does not create a speculative RLS migration.

The current architecture already has concrete RLS/default-privilege and controlled-RPC
foundations. Adding new policies without a proven gap would risk changing authorization
semantics unnecessarily.

The delta is an explicit VNext validation matrix plus architecture tests that freeze the
security boundaries already established by the platform.

## Matrix

The validation matrix covers:

Actors:
- `BROWSER_AUTHENTICATED`
- `SERVER_SERVICE_ROLE`
- `INTELLIGENCE`

Surfaces:
- `PUBLIC_TABLE_READ`
- `DIRECT_TABLE_WRITE`
- `CONTROLLED_RPC_EXECUTE`
- `SERVICE_MAINTENANCE`
- `RLS_BYPASS`

Important invariants:

- browser direct table write: DENY;
- browser controlled RPC: CONDITIONAL on deployed RPC authorization;
- browser service maintenance: DENY;
- browser RLS bypass: DENY;
- Intelligence direct mutation: DENY;
- Intelligence controlled mutation execution: DENY;
- Intelligence service maintenance: DENY;
- Intelligence RLS bypass: DENY;
- service-role operations remain CONDITIONAL and server/tooling-only, not globally allowed.

## Authority

This matrix is a validation contract, not a replacement for:

- deployed PostgreSQL RLS policies;
- SQL grants/revokes;
- Supabase authentication;
- domain controlled RPC authorization;
- Intelligence Permission Model;
- Control Plane human approval/confirmation.

Runtime database authorization remains in the database and existing controlled
application boundaries.

## No new writes

GAP-040 intentionally adds no database migration.

This satisfies the master requirement to validate before new writes and avoids
introducing an unproven RLS change.

## Explicit non-goals

- No PROD.
- No new SQL migration.
- No RLS relaxation.
- No `service_role` browser access.
- No direct browser table mutation.
- No Intelligence RLS bypass.
- No Idempotency implementation (GAP-041).
- No Observability implementation (GAP-042).

## DoD

- read-only audit completed at exact recovery point;
- local and remote recovery matched;
- no audit mutation/commit/push;
- VNext validation matrix exists;
- matrix is complete and default-deny oriented;
- browser service-role/RLS bypass denied;
- Intelligence mutation/RLS bypass denied;
- architecture tests verify default privileges remain deny-first;
- architecture tests verify browser uses publishable key;
- architecture tests verify write modes remain blocked by default;
- architecture tests verify Intelligence autonomy block;
- architecture tests verify Control Plane human confirmation gate;
- database typecheck/build PASS;
- unit tests PASS;
- architecture tests PASS;
- lint PASS;
- staging contains only authorized GAP-040 paths;
- commit/push on `next-phase`;
- LOCAL HEAD = REMOTE HEAD;
- new recovery point registered;
- master continuity updated + readback.
