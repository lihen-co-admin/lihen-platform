import type {
  IntelligenceCandidate,
  IntelligenceContext,
  IntelligenceEvidence,
} from '../contracts';
import type {
  GeneratedReport,
  ProviderResult,
  ReportGenerationPort,
} from '../provider-ports';
import type {
  IntelligenceCapabilityExecutionInput,
  IntelligenceCapabilityExecutionOutput,
  IntelligenceCapabilityHandler,
} from '../orchestrator';

export interface ReportBrief {
  readonly reportId: string;
  readonly title: string;
  readonly purpose: string;
  readonly outputFormat: 'MARKDOWN' | 'HTML' | 'PDF' | 'DOCX' | 'CSV';
  readonly sections: readonly string[];
  readonly sourceEvidenceIds: readonly string[];
  readonly constraints: readonly string[];
}

export interface ReportGenerationDependencies {
  readonly reportGeneration?: ReportGenerationPort;
}

export interface GovernedReportGenerationRequest {
  readonly correlationId: string;
  readonly requestedBy: string;
  readonly context: IntelligenceContext;
  readonly brief: ReportBrief;
}

export type GovernedReportGenerationStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'NO_RESULT'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_FAILED';

export interface GovernedReportGenerationResult {
  readonly status: GovernedReportGenerationStatus;
  readonly evidence: readonly IntelligenceEvidence[];
  readonly candidates: readonly IntelligenceCandidate[];
  readonly messages: readonly string[];
}

function compactId(value: string): string {
  const result = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return result || 'report';
}

function reportEvidence(
  request: GovernedReportGenerationRequest,
  report: GeneratedReport,
  providerName: string,
  index: number,
): IntelligenceEvidence {
  const ref = compactId(report.reportRef);
  const createdAt = new Date().toISOString();

  return {
    evidenceId: `report-evidence-${request.brief.reportId}-${index + 1}-${ref}`,
    correlationId: request.correlationId,
    context: request.context,
    capability: 'REPORT_GENERATION',
    sourceAuthority: {
      level: 'GENERATED',
      sourceName: providerName,
      rationale: [
        'Report artifact was produced through an injected ReportGenerationPort.',
        'GENERATED report output is not canonical domain authority.',
      ],
    },
    observation: `Generated report artifact candidate: ${request.brief.title}.`,
    payload: {
      reportRef: report.reportRef,
      title: report.title,
      mimeType: report.mimeType,
      provenance: report.provenance,
      outputFormat: request.brief.outputFormat,
      purpose: request.brief.purpose,
      sections: request.brief.sections,
      sourceEvidenceIds: request.brief.sourceEvidenceIds,
      constraints: request.brief.constraints,
      metadata: report.metadata,
    },
    confidence: {
      score: 0.5,
      band: 'MEDIUM',
      rationale: [
        'Artifact generation succeeded, but report correctness and fitness require human review.',
        'Confidence is not permission to publish, persist or treat the report as master data.',
      ],
    },
    fingerprint: `generated-report:${request.brief.reportId}:${index + 1}:${report.reportRef}`,
    createdAt,
  };
}

function reportCandidate(
  request: GovernedReportGenerationRequest,
  report: GeneratedReport,
  evidence: IntelligenceEvidence,
  index: number,
): IntelligenceCandidate {
  const ref = compactId(report.reportRef);

  return {
    candidateId: `report-candidate-${request.brief.reportId}-${index + 1}-${ref}`,
    correlationId: request.correlationId,
    type: 'DOCUMENT_ARTIFACT',
    context: request.context,
    payload: {
      reportRef: report.reportRef,
      title: report.title,
      mimeType: report.mimeType,
      provenance: 'GENERATED',
      outputFormat: request.brief.outputFormat,
      purpose: request.brief.purpose,
      sourceEvidenceIds: request.brief.sourceEvidenceIds,
      metadata: report.metadata,
    },
    evidenceIds: [evidence.evidenceId],
    confidence: evidence.confidence,
    status: 'PENDING',
    createdAt: evidence.createdAt,
  };
}

function failureMessage(
  result: ProviderResult<readonly GeneratedReport[]>,
): string {
  return [
    `Report generation provider returned ${result.status}.`,
    ...result.messages,
  ].join(' ');
}

export async function generateGovernedReportCandidates(
  dependencies: ReportGenerationDependencies,
  request: GovernedReportGenerationRequest,
): Promise<GovernedReportGenerationResult> {
  const title = request.brief.title.trim();
  const purpose = request.brief.purpose.trim();

  if (!title || !purpose || request.brief.sections.length === 0) {
    return {
      status: 'NO_RESULT',
      evidence: [],
      candidates: [],
      messages: [
        'Report brief requires title, purpose and at least one section.',
      ],
    };
  }

  if (!dependencies.reportGeneration) {
    return {
      status: 'PROVIDER_NOT_CONFIGURED',
      evidence: [],
      candidates: [],
      messages: [
        'No ReportGenerationPort is configured.',
        'No report artifact, persistence or publication occurred.',
      ],
    };
  }

  const result = await dependencies.reportGeneration.generate({
    correlationId: request.correlationId,
    requestedBy: request.requestedBy,
    context: request.context,
    reportId: request.brief.reportId,
    title,
    purpose,
    outputFormat: request.brief.outputFormat,
    sections: request.brief.sections,
    sourceEvidenceIds: request.brief.sourceEvidenceIds,
    constraints: request.brief.constraints,
  });

  if (result.status !== 'SUCCESS' && result.status !== 'PARTIAL') {
    return {
      status: 'PROVIDER_FAILED',
      evidence: [],
      candidates: [],
      messages: [failureMessage(result)],
    };
  }

  const reports = result.data ?? [];
  if (reports.length === 0) {
    return {
      status: 'NO_RESULT',
      evidence: [],
      candidates: [],
      messages: [
        ...result.messages,
        'Provider returned no generated report artifacts.',
      ],
    };
  }

  const providerName = dependencies.reportGeneration.descriptor.name;
  const evidence = reports.map((report, index) =>
    reportEvidence(request, report, providerName, index),
  );
  const candidates = reports.map((report, index) =>
    reportCandidate(request, report, evidence[index]!, index),
  );

  return {
    status: result.status === 'PARTIAL' ? 'PARTIAL_SUCCESS' : 'SUCCESS',
    evidence,
    candidates,
    messages: [
      ...result.messages,
      `${reports.length} generated report candidate(s) require human review before persistence or publication.`,
    ],
  };
}

function readReportBrief(
  input: IntelligenceCapabilityExecutionInput,
): ReportBrief {
  const raw = input.context.attributes.reportBrief;

  if (
    raw === null
    || typeof raw !== 'object'
    || Array.isArray(raw)
  ) {
    throw new Error('REPORT_BRIEF_REQUIRED');
  }

  const value = raw as Record<string, unknown>;
  const outputFormats = ['MARKDOWN', 'HTML', 'PDF', 'DOCX', 'CSV'] as const;

  if (
    typeof value.reportId !== 'string'
    || typeof value.title !== 'string'
    || typeof value.purpose !== 'string'
    || typeof value.outputFormat !== 'string'
    || !outputFormats.includes(
      value.outputFormat as (typeof outputFormats)[number],
    )
    || !Array.isArray(value.sections)
    || !value.sections.every((item) => typeof item === 'string')
    || !Array.isArray(value.sourceEvidenceIds)
    || !value.sourceEvidenceIds.every((item) => typeof item === 'string')
    || !Array.isArray(value.constraints)
    || !value.constraints.every((item) => typeof item === 'string')
  ) {
    throw new Error('REPORT_BRIEF_INVALID');
  }

  return {
    reportId: value.reportId,
    title: value.title,
    purpose: value.purpose,
    outputFormat: value.outputFormat as ReportBrief['outputFormat'],
    sections: value.sections as string[],
    sourceEvidenceIds: value.sourceEvidenceIds as string[],
    constraints: value.constraints as string[],
  };
}

export function createReportGenerationHandler(
  dependencies: ReportGenerationDependencies,
): IntelligenceCapabilityHandler {
  return {
    capability: 'REPORT_GENERATION',
    async execute(
      input: IntelligenceCapabilityExecutionInput,
    ): Promise<IntelligenceCapabilityExecutionOutput> {
      const report = await generateGovernedReportCandidates(
        dependencies,
        {
          correlationId: input.correlationId,
          requestedBy: input.requestedBy,
          context: input.context,
          brief: readReportBrief(input),
        },
      );

      if (report.status === 'PROVIDER_NOT_CONFIGURED') {
        throw new Error('REPORT_GENERATION_PROVIDER_NOT_CONFIGURED');
      }

      if (report.status === 'PROVIDER_FAILED') {
        throw new Error(
          `REPORT_GENERATION_PROVIDER_FAILED: ${report.messages.join(' ')}`,
        );
      }

      return {
        capability: 'REPORT_GENERATION',
        evidence: report.evidence,
        candidates: report.candidates,
        recommendations: [],
        messages: report.messages,
      };
    },
  };
}
