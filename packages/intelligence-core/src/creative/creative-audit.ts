import {
  lihenBrandConstraints,
} from '../brand/brand-context';


export type CreativeAuditState =
  | 'PASS'
  | 'WARNING'
  | 'FAIL'
  | 'NOT_ASSESSED';


export type LogoVisualObservation =
  | 'OFFICIAL_TRANSPARENT'
  | 'OPAQUE_WHITE_BACKGROUND'
  | 'DISTORTED'
  | 'UNVERIFIED'
  | 'NOT_PRESENT';


export interface LihenCreativeAuditInput {
  readonly instruction:
    string;

  readonly intendedUse:
    string;

  readonly businessLine?:
    string;

  readonly logoObservation?:
    LogoVisualObservation;
}


export interface LihenCreativeAudit {
  readonly brandMatch:
    CreativeAuditState;

  readonly logoIntegrity:
    CreativeAuditState;

  readonly layout:
    CreativeAuditState;

  readonly copy:
    CreativeAuditState;

  readonly channelFit:
    CreativeAuditState;

  readonly evidence:
    'PASS'
    | 'NOT_REQUIRED'
    | 'INCOMPLETE';

  readonly executionState:
    'PREPARED_ONLY';

  readonly overall:
    'PASS'
    | 'WARNING'
    | 'FAIL';

  readonly messages:
    readonly string[];

  readonly recommendations:
    readonly string[];
}


function logoAudit(
  observation:
    LogoVisualObservation | undefined,
): {
  readonly state:
    CreativeAuditState;

  readonly messages:
    readonly string[];

  readonly recommendations:
    readonly string[];
} {

  switch (observation) {
    case 'OFFICIAL_TRANSPARENT':
      return {
        state: 'PASS',
        messages: [
          'Official LIHEN logo is integrated without an accidental opaque background.',
        ],
        recommendations: [],
      };

    case 'OPAQUE_WHITE_BACKGROUND':
      return {
        state: 'WARNING',
        messages: [
          'Visible opaque white background detected around the LIHEN logo.',
        ],
        recommendations: [
          'Use the official transparent logo asset when available.',
          'If transformation is required, remove only the accidental background without altering the symbol, wordmark, color or proportions.',
        ],
      };

    case 'DISTORTED':
      return {
        state: 'FAIL',
        messages: [
          'LIHEN logo appears distorted or materially altered.',
        ],
        recommendations: [
          'Restore the official logo asset without reinterpretation.',
        ],
      };

    case 'NOT_PRESENT':
      return {
        state: 'WARNING',
        messages: [
          'No LIHEN logo was observed in a context that may require brand attribution.',
        ],
        recommendations: [
          'Confirm whether the intended channel requires the official logo.',
        ],
      };

    case 'UNVERIFIED':
    case undefined:
      return {
        state: 'NOT_ASSESSED',
        messages: [
          'Logo integrity requires visual observation before final creative approval.',
        ],
        recommendations: [],
      };
  }
}


export function auditLihenCreativeRequest(
  input:
    LihenCreativeAuditInput,
): LihenCreativeAudit {

  const instruction =
    input.instruction.trim();

  const intendedUse =
    input.intendedUse.trim();

  const messages:
    string[] = [];

  const recommendations:
    string[] = [];


  const attemptsLogoRedesign =
    /\b(redesign|recreate|replace|reinterpret)\b.{0,30}\blogo\b/i
      .test(
        instruction,
      )
    || /\blogo\b.{0,30}\b(redesign|recreate|replace|reinterpret)\b/i
      .test(
        instruction,
      );


  const brandMatch:
    CreativeAuditState =
      input.businessLine === 'BEAUTY_CARE'
      || input.businessLine === 'STYLE'
        ? 'PASS'
        : 'WARNING';


  if (
    brandMatch === 'WARNING'
  ) {
    messages.push(
      'Beauty Care or Style context was not resolved; use shared LIHEN identity only.',
    );
  }


  let copy:
    CreativeAuditState =
      instruction
      && intendedUse
        ? 'PASS'
        : 'FAIL';


  if (
    attemptsLogoRedesign
  ) {
    copy =
      'FAIL';

    messages.push(
      'Creative brief attempts to redesign or reinterpret the official LIHEN logo.',
    );

    recommendations.push(
      'Preserve the official LIHEN logo asset exactly.',
    );
  }


  const logo =
    logoAudit(
      input.logoObservation,
    );

  messages.push(
    ...logo.messages,
  );

  recommendations.push(
    ...logo.recommendations,
  );


  const overall:
    'PASS'
    | 'WARNING'
    | 'FAIL' =
      copy === 'FAIL'
      || logo.state === 'FAIL'
        ? 'FAIL'
        : brandMatch === 'WARNING'
          || logo.state === 'WARNING'
          || logo.state === 'NOT_ASSESSED'
          ? 'WARNING'
          : 'PASS';


  return {
    brandMatch,
    logoIntegrity:
      logo.state,

    layout:
      'NOT_ASSESSED',

    copy,

    channelFit:
      intendedUse
        ? 'PASS'
        : 'FAIL',

    evidence:
      'NOT_REQUIRED',

    executionState:
      'PREPARED_ONLY',

    overall,

    messages,

    recommendations,
  };
}


export function withLihenBrandConstraints(
  existing:
    readonly string[],

  businessLine?:
    string,
): readonly string[] {

  return [
    ...existing,
    ...lihenBrandConstraints(
      businessLine,
    ).filter(
      (constraint) =>
        !existing.includes(
          constraint,
        ),
    ),
  ];
}
