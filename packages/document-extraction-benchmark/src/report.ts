import type {
  BenchmarkCandidateReport,
  BenchmarkRun,
} from './types';

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((a, b) => a + b, 0) /
        values.length;
}

function categoryScore(
  runs: readonly BenchmarkRun[],
  ids: ReadonlySet<string>,
): number {
  return average(
    runs
      .filter((run) => ids.has(run.caseId))
      .map((run) => run.score.total),
  );
}

export function buildCandidateReport(
  candidateId: string,
  runs: readonly BenchmarkRun[],
  caseGroups: Readonly<{
    beautyCare: ReadonlySet<string>;
    style: ReadonlySet<string>;
    edge: ReadonlySet<string>;
    multipart: ReadonlySet<string>;
  }>,
): BenchmarkCandidateReport {
  const durations = runs
    .map((run) => run.result.trace?.durationMs)
    .filter(
      (value): value is number =>
        typeof value === 'number',
    );

  const costs = runs
    .map(
      (run) =>
        run.result.trace?.usage?.costEstimate,
    )
    .filter(
      (value): value is number =>
        typeof value === 'number',
    );

  const multipartRuns = runs.filter(
    (run) => caseGroups.multipart.has(run.caseId),
  );

  return {
    candidateId,
    runs,
    summary: {
      averageScore: average(
        runs.map((run) => run.score.total),
      ),
      beautyCareScore: categoryScore(
        runs,
        caseGroups.beautyCare,
      ),
      styleScore: categoryScore(
        runs,
        caseGroups.style,
      ),
      edgeScore: categoryScore(
        runs,
        caseGroups.edge,
      ),
      criticalFailureCount: runs.reduce(
        (count, run) =>
          count + run.hardGate.failures.length,
        0,
      ),
      partialCount: runs.filter(
        (run) =>
          run.result.status === 'PARTIAL',
      ).length,
      failedCount: runs.filter(
        (run) =>
          run.result.status === 'FAILED',
      ).length,
      ...(durations.length === 0
        ? {}
        : {
            averageDurationMs:
              average(durations),
          }),
      ...(costs.length === 0
        ? {}
        : {
            estimatedCost:
              costs.reduce((a, b) => a + b, 0),
          }),
      multipartPassed:
        multipartRuns.every((run) => run.passed),
    },
  };
}
