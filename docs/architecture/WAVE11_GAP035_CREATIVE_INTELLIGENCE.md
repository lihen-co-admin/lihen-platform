# WAVE 11 / GAP-035 — Creative Intelligence

## Classification

BUILD + REUSE / DELTA-FIRST.

## Recovery point

`fffbaea9135281d6f9f6af37c4436241aec350ba`

## Master scope

`GAP-035 Creative Intelligence — BUILD con provenance GENERATED. ORDER 35.`

## Existing architecture reused

- `CREATIVE_INTELLIGENCE` capability from the shared Intelligence contracts.
- `INTELLIGENCE_PERMISSION.GENERATE` enforced by the existing Orchestrator.
- provider-neutral `ImageGenerationPort`.
- `GeneratedImage.provenance = 'GENERATED'`.
- `SourceAuthorityLevel = 'GENERATED'`.
- existing Evidence → Candidate → Human Review model.

## Delta

GAP-035 adds a provider-neutral Creative Intelligence capability.

A creative brief contains:

- `briefId`
- instruction
- intended use
- source asset references
- constraints

The capability passes that brief to an injected `ImageGenerationPort`.
Each generated result becomes:

1. `IntelligenceEvidence` with `sourceAuthority.level = GENERATED`;
2. a `PENDING` `IntelligenceCandidate`;
3. payload metadata that preserves `provenance = GENERATED`.

Generated output is therefore explicitly distinguishable from:

- official assets;
- first-party assets;
- verified supplier evidence;
- canonical product imagery.

## Governance

Creative generation is not business authority.

The Orchestrator must grant:

- `intelligence.read_context`
- `intelligence.generate`

before the provider handler executes.

A generated candidate is never automatically:

- uploaded to canonical storage;
- selected as canonical product image;
- inserted into Product Master;
- published to a catalog;
- published to social media;
- used to replace an official brand asset.

Those actions remain separate governed workflows and require later explicit authorization.

## Provider boundary

No image-generation vendor is hardcoded in intelligence-core.

The capability only knows `ImageGenerationPort`.

Provider credentials and runtime adapters stay outside this package.

## Explicit non-goals

- No Supabase migration.
- No new bucket.
- No generated-asset persistence.
- No canonical asset mutation.
- No publishing.
- No social automation.
- No hardcoded provider SDK.
- No browser API key.
- No Creative UI expansion in this GAP.
- No Document/Report Intelligence (GAP-036).
- No analytics (GAP-037).
- No automation engine (GAP-038).
- No PROD.

## DoD

- Creative Intelligence exported from `@lihen/intelligence-core`.
- generated artifacts preserve `GENERATED` provenance.
- generated evidence uses `SourceAuthority.level = GENERATED`.
- generated candidates remain `PENDING`.
- missing provider fails closed.
- provider failure produces no fake evidence/candidate.
- Orchestrator permission denial prevents provider execution.
- no persistence/publish/canonical mutation boundary.
- unit tests PASS.
- architecture tests PASS.
- intelligence-core typecheck/build PASS.
- lint PASS for authorized TypeScript delta.
- staging contains only authorized GAP-035 paths.
- commit/push on `next-phase`.
- LOCAL HEAD = REMOTE HEAD.
- new recovery point registered.
- master continuity updated + readback.
