import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('WAVE 11 / GAP-036 Document & Report Generation architecture', () => {
  const contracts = read('packages/intelligence-core/src/contracts.ts');
  const providers = read('packages/intelligence-core/src/provider-ports.ts');
  const orchestrator = read('packages/intelligence-core/src/orchestrator.ts');
  const capability = read(
    'packages/intelligence-core/src/capabilities/report-generation.ts',
  );
  const index = read('packages/intelligence-core/src/index.ts');

  it('adds a distinct REPORT_GENERATION capability without replacing Document Intelligence extraction', () => {
    expect(contracts).toContain("| 'REPORT_GENERATION'");
    expect(contracts).toContain("| 'DOCUMENT_INTELLIGENCE'");
    expect(index).toContain(
      "export * from './capabilities/report-generation';",
    );
  });

  it('adds a provider-neutral report generation port with GENERATED provenance', () => {
    expect(providers).toContain('export interface ReportGenerationPort');
    expect(providers).toContain("readonly provenance: 'GENERATED'");
    expect(providers).toContain('readonly reportGeneration?: ReportGenerationPort');
  });

  it('requires intelligence.generate through the existing Orchestrator', () => {
    expect(orchestrator).toContain('REPORT_GENERATION:');
    expect(orchestrator).toContain(
      'permission: INTELLIGENCE_PERMISSION.GENERATE',
    );
    expect(capability).toContain("capability: 'REPORT_GENERATION'");
  });

  it('keeps report output generated, pending and reviewable', () => {
    expect(capability).toContain("level: 'GENERATED'");
    expect(capability).toContain("provenance: 'GENERATED'");
    expect(capability).toContain("type: 'DOCUMENT_ARTIFACT'");
    expect(capability).toContain("status: 'PENDING'");
    expect(capability).toContain('require human review');
  });

  it('does not persist, publish or call concrete external document libraries/APIs directly', () => {
    expect(capability).not.toMatch(
      /@supabase|createClient\(|getBrowserSupabaseClient|\.from\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(/i,
    );

    // Match concrete imports/API usage, not valid abstract format names such as "DOCX".
    expect(capability).not.toMatch(
      /from\s+['"]googleapis['"]|from\s+['"]@google\/|require\(['"]googleapis['"]\)|docs\.google\.com|drive\.google\.com|from\s+['"]puppeteer['"]|from\s+['"]playwright['"]|from\s+['"]pdfkit['"]|from\s+['"]jspdf['"]|from\s+['"]docx['"]|require\(['"]docx['"]\)/i,
    );

    expect(capability).not.toMatch(
      /publishReport|publishDocument|uploadReport|setCanonical|confirmOperation\(/i,
    );
  });

  it('does not implement GAP-037 analytics or GAP-038 automation', () => {
    expect(capability).not.toMatch(
      /ANALYTICS|AUTOMATION|schedule|cron|forecast|dashboard metric/i,
    );
  });
});
