import { getBrowserSupabaseClient } from '@lihen/database';

export type Phase4Readiness = 'READY' | 'BLOCKED' | 'UNKNOWN';

export interface Phase3Status {
  readonly runStatus: string;
  readonly batchStatus: string;
  readonly verificationStatus: string;
  readonly phase4Readiness: Phase4Readiness;
  readonly phase4Reason: string;
}

export interface VerificationCheck {
  readonly check_code: string;
  readonly status: string;
  readonly issue_count: number;
  readonly details: unknown;
}

export interface Phase3CutoverComposition {
  loadStatus(runId: string): Promise<Phase3Status>;
  verify(runId: string): Promise<readonly VerificationCheck[]>;
}

export function createPhase3CutoverComposition(
  env: Record<string, unknown> = import.meta.env,
): Phase3CutoverComposition {
  const supabase = getBrowserSupabaseClient(env);

  return {
    async loadStatus(runId) {
      const { data, error } = await supabase.rpc('get_phase3_cutover_gate_controlled', {
        p_run_id: runId,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : null;
      if (!row) throw new Error('No se encontró el gate de salida de FASE 3.');

      return {
        runStatus: String(row.phase3_run_status ?? 'UNKNOWN'),
        batchStatus: String(row.phase3_batch_status ?? 'UNKNOWN'),
        verificationStatus: String(row.phase3_verification_status ?? 'UNKNOWN'),
        phase4Readiness:
          row.phase4_readiness === 'READY'
            ? 'READY'
            : row.phase4_readiness === 'BLOCKED'
              ? 'BLOCKED'
              : 'UNKNOWN',
        phase4Reason: String(row.readiness_reason ?? 'UNKNOWN'),
      };
    },

    async verify(runId) {
      const { data, error } = await supabase.rpc('verify_phase3_cutover_controlled', {
        p_run_id: runId,
      });

      if (error) throw error;

      return (Array.isArray(data) ? data : []) as VerificationCheck[];
    },
  };
}

export const phase3CutoverComposition = createPhase3CutoverComposition();
