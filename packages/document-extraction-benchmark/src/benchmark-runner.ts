import {
  evaluateHardGates,
  scoreExtraction,
} from './scorer';
import {
  validateCaseExpectations,
  validateDocumentExtraction,
  validateProviderResult,
} from './validators';
import type {
  BenchmarkCandidate,
  BenchmarkRun,
  DocumentExtractionBenchmarkCase,
} from './types';

let sequence = 0;

function nextRunId(candidateId: string, caseId: string): string {
  sequence += 1;
  return ['benchmark', candidateId, caseId, String(sequence)].join(':');
}

export async function runBenchmarkCase(
  candidate: BenchmarkCandidate,
  benchmarkCase: DocumentExtractionBenchmarkCase,
): Promise<BenchmarkRun> {
  const started = new Date();
  const result = await candidate.port.extract(benchmarkCase.request);

  const validationIssues = [
    ...validateProviderResult(result),
    ...(result.data ? validateDocumentExtraction(benchmarkCase.request, result.data) : []),
  ];
  const expectationIssues = validateCaseExpectations(benchmarkCase, result);
  const score = scoreExtraction(benchmarkCase.groundTruth, result);
  const hardGate = evaluateHardGates(
    benchmarkCase.groundTruth,
    result,
    benchmarkCase.expectations,
  );

  return {
    runId: nextRunId(candidate.candidateId, benchmarkCase.caseId),
    candidateId: candidate.candidateId,
    caseId: benchmarkCase.caseId,
    startedAt: started.toISOString(),
    finishedAt: new Date().toISOString(),
    result,
    validationIssues,
    expectationIssues,
    score,
    hardGate,
    passed: validationIssues.length === 0 && expectationIssues.length === 0 && hardGate.passed,
  };
}
