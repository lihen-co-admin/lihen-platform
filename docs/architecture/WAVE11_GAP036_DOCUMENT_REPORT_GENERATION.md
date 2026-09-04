# WAVE 11 / GAP-036 — Document & Report Generation

## Classification

BUILD + REUSE / DELTA-FIRST.

## Recovery point

`ed35829207f0f4255971de79a7b6f094679dc4e8`

## Master scope

`GAP-036 Document & Report Generation — BUILD. ORDER 36.`

## Audit finding

LIHEN already has Document Intelligence from GAP-019 for supplier-document extraction.

That pipeline is preserved as-is:

Document → extraction → evidence → prepared source records → human review.

GAP-036 does not duplicate extraction.

The missing direction is governed generation:

Context/evidence → report brief → generated report artifact → human review.

## Shared contracts extended

GAP-036 adds:

- `REPORT_GENERATION` as a distinct Intelligence capability;
- `DOCUMENT_ARTIFACT` as a reviewable candidate type;
- provider-neutral `ReportGenerationPort`;
- `GeneratedReport` with mandatory `provenance = GENERATED`.

`REPORT_GENERATION` requires the existing `intelligence.generate` permission through
the Orchestrator.

## Report brief

A report brief includes:

- report id;
- title;
- purpose;
- output format;
- ordered sections;
- source evidence ids;
- constraints.

Supported abstract output formats:

- MARKDOWN
- HTML
- PDF
- DOCX
- CSV

These are intent formats only. intelligence-core does not contain a concrete renderer.

## Governance

Generated report output becomes:

1. `IntelligenceEvidence` with `SourceAuthority.level = GENERATED`;
2. a `PENDING` `DOCUMENT_ARTIFACT` candidate.

It is not automatically:

- persisted to storage;
- uploaded to Google Drive;
- inserted into an artifact registry;
- published;
- emailed;
- attached to a catalog;
- used as canonical financial or operational truth.

A generated report remains derived output from governed source evidence.

## Provider boundary

`ReportGenerationPort` is provider-neutral.

The core does not know:

- Google Docs API;
- Google Drive API;
- PDFKit/jsPDF;
- Puppeteer/Playwright;
- DOCX libraries;
- external vendor credentials.

Concrete renderers belong at a trusted infrastructure/application boundary.

## Explicit non-goals

- No Supabase migration.
- No new bucket.
- No file persistence.
- No Google Drive write.
- No PDF renderer implementation.
- No email.
- No publishing.
- No analytics implementation (GAP-037).
- No automation engine (GAP-038).
- No PROD.

## DoD

- `REPORT_GENERATION` contract exists.
- `DOCUMENT_ARTIFACT` candidate type exists.
- `ReportGenerationPort` exists.
- generated report provenance is mandatory `GENERATED`.
- Orchestrator requires `intelligence.generate`.
- generated evidence uses `SourceAuthority.level = GENERATED`.
- generated candidate remains `PENDING`.
- missing provider fails closed.
- provider failure produces no fake artifact.
- no persistence/publishing/external document API in core.
- unit tests PASS.
- architecture tests PASS.
- intelligence-core typecheck/build PASS.
- lint PASS for authorized TypeScript delta.
- staging contains only GAP-036 authorized paths.
- commit/push on `next-phase`.
- LOCAL HEAD = REMOTE HEAD.
- new recovery point registered.
- master continuity updated + readback.
