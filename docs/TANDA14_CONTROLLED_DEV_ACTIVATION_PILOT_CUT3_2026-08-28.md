# TANDA 14 — Controlled DEV Activation Pilot
## CUT 3 — Supplier Pilot Evidence Audit
Fecha: 2026-08-28

## Purpose
Collect exact evidence from the current local repository before any first real
supplier mutation in DEV.

## Static source evidence
The audit checks for:
- supplier controlled mode;
- supplier controlled RPC/command;
- operation key/idempotency plumbing;
- authorization/RLS evidence;
- audit-trail evidence;
- supplier composition/repository/migrations.

## Runtime evidence deliberately deferred
CUT 3 does not execute:
- supplier create/update;
- compensation;
- isolated fixture write;
- post-write verification;
- idempotency replay.

Those remain `NEEDS_RUNTIME_PROOF`.

## Safety
This CUT does not:
- edit `.env`;
- enable `VITE_SUPPLIER_WRITE_MODE`;
- call Supabase;
- apply migrations;
- enable dispatch;
- enable canary;
- implement final EXECUTE;
- touch PROD.

The generated source-audit JSON/Markdown are evidence outputs from the user's exact
working tree and must be reviewed before CUT 4 can define a controlled DEV fixture.
