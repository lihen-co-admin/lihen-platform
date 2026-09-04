# WAVE 10 / GAP-034 — LIHEN Assistant

## Classification

BUILD + REUSE / DELTA-FIRST.

## Recovery point

`78259cd0bf97597bb85a6674ecf098a8d1f0238d`

## Master scope

LIHEN Assistant is the conversational interface / orchestrator surface of the system.

GAP-034 is built on existing governed foundations:

- GAP-033 Assistant Context Resolver.
- GAP-006 Intelligence Orchestrator.
- GAP-007 provider-neutral `ModelPort`.
- GAP-008 Intelligence ↔ Existing Control Plane.
- existing Control Center protected shell.

## Architecture

`runLihenAssistantTurn()` follows:

1. explicit assistant prompt;
2. governed context query;
3. `intelligence.read_context` through GAP-033;
4. `ASSISTANT` capability through the existing Orchestrator;
5. provider-neutral `ModelPort`;
6. answer/recommendation result;
7. any mutation remains outside the Assistant turn.

Controlled operations follow a separate path:

Recommendation → explicit human Decision(APPROVE) → existing Control Plane preparation →
explicit application/human confirmation.

The Assistant never calls Control Plane confirmation automatically.

## UI

Control Center adds `/assistant` as a protected conversational surface.

The browser UI does not contain a provider credential or model SDK. Until a trusted
runtime adapter is configured, it explicitly reports `PROVIDER_NOT_CONFIGURED` rather
than pretending to execute an AI call.

This is intentional fail-closed behavior.

## Explicit non-goals

- No browser API keys.
- No hardcoded OpenAI/Anthropic/Gemini vendor.
- No new Supabase table/view/RPC.
- No direct SQL.
- No autonomous price/inventory/purchase/sale/finance mutation.
- No autonomous lifecycle change.
- No autonomous publishing.
- No automatic Control Plane confirmation.
- No Creative Intelligence implementation (GAP-035).
- No Document/Report Intelligence expansion (GAP-036).
- No analytics implementation (GAP-037).
- No autonomous automation engine (GAP-038).
- No PROD.

## DoD

- Assistant facade exported from `@lihen/intelligence-core`.
- context resolution precedes provider execution.
- Orchestrator executes `ASSISTANT` capability.
- provider remains behind `ModelPort`.
- no provider is called when context permission is denied.
- no-provider state fails closed.
- provider errors are surfaced as governed failures.
- Control Plane handoff requires explicit human approval.
- protected `/assistant` route exists in Control Center.
- conversational UI contains no secrets/provider SDK/direct mutation.
- unit tests PASS.
- architecture tests PASS.
- intelligence-core typecheck/build PASS.
- control-center typecheck/build PASS.
- lint PASS for authorized TypeScript delta.
- staging contains only authorized GAP-034 paths.
- commit/push on `next-phase`.
- LOCAL HEAD = REMOTE HEAD.
- new recovery point registered.
- master continuity updated + readback.
