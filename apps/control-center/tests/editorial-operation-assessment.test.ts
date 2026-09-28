import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PublicationAttempt } from '@lihen/marketing';
import {
  createEditorialDraft,
  programEditorial,
  reviewEditorial,
} from '../src/composition/editorial-workspace';
import { assessEditorialOperation } from '../src/domain/editorial-operation-assessment';
import { EditorialOperationAssessment } from '../src/components/EditorialOperationAssessment';
import type { EditorialItem } from '../src/domain/editorial-planning';

const now = new Date('2026-09-28T16:00:00Z');
function draft(): EditorialItem {
  let id = 0;
  return createEditorialDraft(
    {
      copy: 'Copy',
      callToAction: '',
      hashtags: '',
      creativeAssetIds: ['image'],
      channels: ['INSTAGRAM_FEED'],
      productId: '',
      campaignName: '',
      date: '',
    },
    now,
    () => `id-${++id}`,
  )[0]!;
}
async function scheduled() {
  const approved = await reviewEditorial(
    await reviewEditorial(draft(), 'SUBMIT_FOR_REVIEW', now),
    'APPROVE',
    now,
  );
  return programEditorial(approved, '2026-09-29T10:00', now, () => 'schedule');
}
function blockers(item: EditorialItem, at = now) {
  return assessEditorialOperation(item, at)
    .checks.filter((check) => !check.observed)
    .map((check) => check.code);
}
function attempt(
  status: PublicationAttempt['status'],
  externalPublicationRef: string | null = null,
): PublicationAttempt {
  return {
    id: 'attempt',
    preparedPublicationId: draft().publication.id,
    attemptNumber: 1,
    status,
    startedAt: now,
    completedAt: null,
    externalPublicationRef,
    failureCode: null,
  };
}

describe('editorial operational assessment', () => {
  it('follows the existing separate review, approval and scheduling flow without executing', async () => {
    const item = draft();
    expect(blockers(item)).toEqual([
      'PUBLICATION_APPROVAL',
      'SCHEDULE_LINK',
      'SCHEDULE_APPROVAL',
      'DUE',
    ]);
    const reviewed = await reviewEditorial(item, 'SUBMIT_FOR_REVIEW', now);
    expect(blockers(reviewed)).toContain('PUBLICATION_APPROVAL');
    const approved = await reviewEditorial(reviewed, 'APPROVE', now);
    expect(blockers(approved)).not.toContain('PUBLICATION_APPROVAL');
    expect(blockers(approved)).toContain('SCHEDULE_APPROVAL');
    const programmed = await scheduled();
    expect(blockers(programmed)).toEqual(['DUE']);
    const before = JSON.stringify(programmed);
    const assessment = assessEditorialOperation(programmed, programmed.schedule!.scheduledFor);
    expect(assessment.observedRequirementsMet).toBe(true);
    expect(assessment.executionAllowed).toBe(false);
    expect(programmed.attempts).toEqual([]);
    expect(JSON.stringify(programmed)).toBe(before);
  });

  it.each(['TIKTOK', 'INSTAGRAM_REEL', 'WHATSAPP_DIRECT'] as const)(
    'keeps %s unavailable even when approved and due',
    async (channel) => {
      const item = await scheduled();
      const assessment = assessEditorialOperation(
        { ...item, publication: { ...item.publication, channel } },
        item.schedule!.scheduledFor,
      );
      expect(assessment.checks.find((check) => check.code === 'CHANNEL')?.observed).toBe(false);
      expect(assessment.observedRequirementsMet).toBe(false);
      expect(assessment.executionAllowed).toBe(false);
    },
  );

  it.each(['FACEBOOK', 'INSTAGRAM_FEED', 'INSTAGRAM_STORY'] as const)(
    'recognizes %s without claiming activation',
    (channel) => {
      const item = draft();
      const assessment = assessEditorialOperation(
        { ...item, publication: { ...item.publication, channel } },
        now,
      );
      expect(assessment.checks[0]?.observed).toBe(true);
      expect(assessment.checks[0]?.message).toContain('activación no verificada');
      expect(assessment.executionAllowed).toBe(false);
    },
  );

  it('fails closed on missing or mismatched schedule linkage', async () => {
    const item = await scheduled();
    for (const schedule of [
      null,
      { ...item.schedule!, id: 'other' },
      { ...item.schedule!, channelVariantId: 'sibling' },
    ]) {
      expect(blockers({ ...item, schedule })).toContain('SCHEDULE_LINK');
    }
    expect(blockers({ ...item, publication: { ...item.publication, scheduleId: null } })).toContain(
      'SCHEDULE_LINK',
    );
  });

  it('does not inherit approval from a sibling, a cancelled schedule or a cancelled publication', async () => {
    const item = await scheduled();
    expect(
      blockers({ ...item, publication: { ...item.publication, status: 'CANCELLED' } }),
    ).toContain('PUBLICATION_APPROVAL');
    expect(blockers({ ...item, schedule: { ...item.schedule!, status: 'CANCELLED' } })).toContain(
      'SCHEDULE_APPROVAL',
    );
    expect(blockers(draft())).toContain('PUBLICATION_APPROVAL');
  });

  it('rejects invalid dates and checks the first media reference used by runtime', async () => {
    const item = await scheduled();
    expect(blockers(item, new Date('invalid'))).toContain('DUE');
    expect(
      blockers({ ...item, schedule: { ...item.schedule!, scheduledFor: new Date('invalid') } }),
    ).toContain('DUE');
    for (const creativeAssetIds of [[], ['', 'second-image'], ['   ']]) {
      expect(
        blockers({ ...item, publication: { ...item.publication, creativeAssetIds } }),
      ).toContain('MEDIA_REFERENCE');
    }
  });

  it.each([
    ['PENDING', 'no crear otro'],
    ['IN_PROGRESS', 'no reintentar'],
    ['FAILED', 'No autoriza reintento automático'],
    ['CANCELLED', 'no autoriza otro intento'],
  ] as const)('provides non-executing follow-up for %s attempts', async (status, message) => {
    const item = { ...(await scheduled()), attempts: [attempt(status)] };
    const assessment = assessEditorialOperation(item, item.schedule!.scheduledFor);
    expect(assessment.observedRequirementsMet).toBe(false);
    expect(assessment.followUp[0]?.message).toContain(message);
    expect(assessment.executionAllowed).toBe(false);
  });

  it.each([null, 'local-test-publication'])(
    'does not present success reference %s as external evidence',
    (ref) => {
      const assessment = assessEditorialOperation(
        { ...draft(), attempts: [attempt('SUCCEEDED', ref)] },
        now,
      );
      expect(assessment.followUp[0]?.message).toContain('una simulación no acredita publicación');
    },
  );

  it('preserves every attempt including prior success and flags foreign associations', () => {
    const attempts = [
      attempt('SUCCEEDED', 'external-reference'),
      { ...attempt('FAILED'), id: 'second', attemptNumber: 2 },
      { ...attempt('PENDING'), id: 'foreign', preparedPublicationId: 'other' },
    ];
    const assessment = assessEditorialOperation({ ...draft(), attempts }, now);
    expect(assessment.followUp).toHaveLength(3);
    expect(assessment.followUp[0]?.message).toContain('no volver a publicar');
    expect(assessment.followUp[2]?.message).toContain('Asociación inconsistente');
  });

  it('renders traceable identifiers and uncertainties without buttons, links or mutation', async () => {
    const item = await scheduled();
    const before = JSON.stringify(item);
    const html = renderToStaticMarkup(
      createElement(EditorialOperationAssessment, { item, now: item.schedule!.scheduledFor }),
    );
    for (const text of [
      'Requisitos editoriales observables cumplidos',
      'Ejecución bloqueada',
      'estado actual del servidor no',
      'contenido generado no es oficial',
      item.publication.id,
      item.publication.campaignId,
      item.publication.campaignContentId,
      item.publication.channelVariantId,
      'schedule',
      'image',
    ]) {
      expect(html).toContain(text);
    }
    expect(html).not.toMatch(/<button|<a\s|<form/);
    expect(JSON.stringify(item)).toBe(before);
  });
});
