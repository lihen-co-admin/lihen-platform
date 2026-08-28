export type OperationalActivationState =
  | 'DEV_CONTROLLED_CAPABLE'
  | 'PREPARED_BUT_HELD'
  | 'NOT_ACTIVATABLE';

export interface OperationalActivationCapability {
  readonly id: string;
  readonly label: string;
  readonly state: OperationalActivationState;
  readonly rationale: readonly string[];
}

export interface OperationalActivationReadiness {
  readonly capabilities: readonly OperationalActivationCapability[];
  readonly productionMustRemainUntouched: true;
  readonly finalExecutionMustRemainBlocked: true;
  readonly canaryMustRemainDisabled: true;
  readonly dispatchMustRemainHeld: true;
}

/**
 * Readiness documental de capacidades. No lee secretos ni activa flags.
 *
 * DEV_CONTROLLED_CAPABLE significa que existe una vía de comando/RPC controlado,
 * pero su uso depende de que el entorno DEV habilite explícitamente el write mode
 * correspondiente y de las políticas/RLS del dominio.
 *
 * PREPARED_BUT_HELD significa que existen contratos/read models/gates, pero la
 * ejecución está deliberadamente retenida.
 *
 * NOT_ACTIVATABLE significa que el flujo final no está implementado o no debe
 * habilitarse en esta tanda.
 */
export function evaluateOperationalActivationReadiness(): OperationalActivationReadiness {
  const capabilities: OperationalActivationCapability[] = [
    {
      id: 'product-master-writes',
      label: 'Product Master controlado',
      state: 'DEV_CONTROLLED_CAPABLE',
      rationale: [
        'Create/update/price/image usan modos de write controlados por entorno.',
        'La UI no debe escribir tablas de negocio directamente.',
      ],
    },
    {
      id: 'inventory-supply-commerce-finance-writes',
      label: 'Inventario, abastecimiento, comercio y finanzas controlados',
      state: 'DEV_CONTROLLED_CAPABLE',
      rationale: [
        'Los repositorios Supabase exigen controlledWriteEnabled para mutaciones.',
        'Los ejemplos de entorno permanecen bloqueados por defecto.',
      ],
    },
    {
      id: 'operation-intent-preview-confirm',
      label: 'Prepare/confirm de intención operativa',
      state: 'PREPARED_BUT_HELD',
      rationale: [
        'Prepare y confirm son governance/control-plane, no ejecución final.',
        'El catálogo exige executionEnabled=false.',
      ],
    },
    {
      id: 'dispatch',
      label: 'Dispatch',
      state: 'PREPARED_BUT_HELD',
      rationale: [
        'Los contratos pueden estar compilados.',
        'dispatchAllowed debe permanecer false y el presupuesto de ejecución en 0.',
      ],
    },
    {
      id: 'canary',
      label: 'Canary DEV',
      state: 'PREPARED_BUT_HELD',
      rationale: [
        'La simulación existe para candidatas elegibles.',
        'canaryEnabled debe permanecer false y maxCanaryAttemptsPerHour en 0.',
      ],
    },
    {
      id: 'final-release-execution',
      label: 'Release final / EXECUTE',
      state: 'NOT_ACTIVATABLE',
      rationale: [
        'La autorización final de ejecución no está implementada.',
        'No debe añadirse una vía EXECUTE general en esta tanda.',
      ],
    },
    {
      id: 'production',
      label: 'Producción',
      state: 'NOT_ACTIVATABLE',
      rationale: [
        'PROD permanece fuera de alcance durante esta continuidad.',
        'Cualquier promoción requiere una decisión futura, explícita y separada.',
      ],
    },
  ];

  return {
    capabilities,
    productionMustRemainUntouched: true,
    finalExecutionMustRemainBlocked: true,
    canaryMustRemainDisabled: true,
    dispatchMustRemainHeld: true,
  };
}
