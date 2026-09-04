import { describe, expect, it } from 'vitest';
import {
  createReportGenerationHandler,
  generateGovernedReportCandidates,
  INTELLIGENCE_PERMISSION,
  orchestrateIntelligenceRequest,
} from '../src';
import type {
  PermissionPrincipal,
  ReportGenerationPort,
} from '../src';

const context = {
  contextId: 'ctx-report',
  type: 'DOCUMENT' as const,
  attributes: {
    reportBrief: {
      reportId: 'report-1',
      title: 'LIHEN Operational Review',
      purpose: 'Summarize governed evidence for human review.',
      outputFormat: 'PDF' as const,
      sections: ['Executive summary', 'Evidence', 'Risks'],
      sourceEvidenceIds: ['evidence-1', 'evidence-2'],
      constraints: ['no autonomous conclusions', 'cite source evidence'],
    },
  },
};

const reportPort: ReportGenerationPort = {
  descriptor: {
    toolId: 'report-generator-test',
    kind: 'GENERATION',
    name: 'Test Report Generator',
    version: '1',
    description: 'Deterministic report generator for tests',
    readOnly: false,
  },
  async generate() {
    return {
      status: 'SUCCESS',
      data: [
        {
          reportRef: 'generated://report-1.pdf',
          title: 'LIHEN Operational Review',
          mimeType: 'application/pdf',
          provenance: 'GENERATED',
          metadata: {
            pageCount: 3,
          },
        },
      ],
      messages: ['REPORT_GENERATION_OK'],
    };
  },
};

const allowedPrincipal: PermissionPrincipal = {
  actorId: 'report-intelligence',
  actorType: 'INTELLIGENCE',
  grants: [
    {
      permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
      effect: 'ALLOW',
      source: 'test',
    },
    {
      permission: INTELLIGENCE_PERMISSION.GENERATE,
      effect: 'ALLOW',
      source: 'test',
    },
  ],
};

describe('WAVE 11 / GAP-036 Document & Report Generation', () => {
  it('produces GENERATED evidence and a pending DOCUMENT_ARTIFACT candidate', async () => {
    const result = await generateGovernedReportCandidates(
      { reportGeneration: reportPort },
      {
        correlationId: 'corr-report-1',
        requestedBy: 'owner',
        context,
        brief: context.attributes.reportBrief,
      },
    );

    expect(result.status).toBe('SUCCESS');
    expect(result.evidence).toHaveLength(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.evidence[0]?.sourceAuthority.level).toBe('GENERATED');
    expect(result.evidence[0]?.payload?.provenance).toBe('GENERATED');
    expect(result.candidates[0]?.type).toBe('DOCUMENT_ARTIFACT');
    expect(result.candidates[0]?.status).toBe('PENDING');
    expect(result.candidates[0]?.payload.provenance).toBe('GENERATED');
  });

  it('fails closed when no report provider is configured', async () => {
    const result = await generateGovernedReportCandidates(
      {},
      {
        correlationId: 'corr-report-no-provider',
        requestedBy: 'owner',
        context,
        brief: context.attributes.reportBrief,
      },
    );

    expect(result.status).toBe('PROVIDER_NOT_CONFIGURED');
    expect(result.evidence).toEqual([]);
    expect(result.candidates).toEqual([]);
  });

  it('requires GENERATE permission before executing the report provider', async () => {
    let calls = 0;
    const trackingPort: ReportGenerationPort = {
      ...reportPort,
      async generate(request) {
        calls += 1;
        return reportPort.generate(request);
      },
    };

    const execution = await orchestrateIntelligenceRequest(
      {
        handlers: [
          createReportGenerationHandler({
            reportGeneration: trackingPort,
          }),
        ],
      },
      {
        requestId: 'req-report-denied',
        correlationId: 'corr-report-denied',
        requestedBy: 'owner',
        principal: {
          actorId: 'report-intelligence',
          actorType: 'INTELLIGENCE',
          grants: [
            {
              permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
              effect: 'ALLOW',
              source: 'test',
            },
          ],
        },
        context,
        intent: {
          intentId: 'intent-report-denied',
          name: 'Generate report',
          description: 'Generate governed report artifact',
          requestedCapabilities: ['REPORT_GENERATION'],
          requiresVerification: false,
          expectedOutput: 'REPORT',
        },
      },
    );

    expect(execution.result.status).toBe('PERMISSION_DENIED');
    expect(calls).toBe(0);
  });

  it('runs through the Orchestrator without publishing or creating recommendations', async () => {
    const execution = await orchestrateIntelligenceRequest(
      {
        handlers: [
          createReportGenerationHandler({
            reportGeneration: reportPort,
          }),
        ],
      },
      {
        requestId: 'req-report',
        correlationId: 'corr-report',
        requestedBy: 'owner',
        principal: allowedPrincipal,
        context,
        intent: {
          intentId: 'intent-report',
          name: 'Generate report',
          description: 'Generate governed report artifact',
          requestedCapabilities: ['REPORT_GENERATION'],
          requiresVerification: false,
          expectedOutput: 'REPORT',
        },
      },
    );

    expect(execution.result.status).toBe('SUCCESS');
    expect(execution.executedCapabilities).toEqual(['REPORT_GENERATION']);
    expect(execution.recommendations).toEqual([]);
    expect(execution.candidates[0]?.status).toBe('PENDING');
  });

  it('does not create fake artifacts when the report provider fails', async () => {
    const failingPort: ReportGenerationPort = {
      ...reportPort,
      async generate() {
        return {
          status: 'FAILED',
          messages: ['REPORT_RENDERER_DOWN'],
        };
      },
    };

    const result = await generateGovernedReportCandidates(
      { reportGeneration: failingPort },
      {
        correlationId: 'corr-report-failed',
        requestedBy: 'owner',
        context,
        brief: context.attributes.reportBrief,
      },
    );

    expect(result.status).toBe('PROVIDER_FAILED');
    expect(result.evidence).toEqual([]);
    expect(result.candidates).toEqual([]);
    expect(result.messages.join(' ')).toContain('REPORT_RENDERER_DOWN');
  });
});
