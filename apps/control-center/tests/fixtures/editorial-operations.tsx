// Browser fixture only. Never imported by the application; no network client.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorialOperationalActions } from '../../src/components/EditorialOperationalActions';
import { createEditorialDraft } from '../../src/composition/editorial-workspace';
import { createEditorialOperations } from '../../src/composition/editorial-operations';
import { MemoryRouter } from 'react-router-dom';
import { EditorialComposer } from '../../src/components/EditorialComposer';
import { resolveProductAssociationsFromMedia } from '../../src/composition/editorial-workspace';

const mode = new URLSearchParams(window.location.search).get('mode');
const tiktok = mode === 'tiktok';
const creator = {
  accountId: 'local-creator', revision: 'test-v1', privacyOptions: ['SELF_ONLY'],
  consentText: 'Consiento esta publicación de prueba', maxVideoDurationSec: 120,
  interactions: [{ key: 'interaction', label: 'Interacción de prueba', allowed: true }, { key: 'blocked', label: 'Interacción restringida', allowed: false }],
};

const item = createEditorialDraft(
  {
    copy: 'Contenido de prueba local',
    callToAction: '',
    hashtags: '',
    creativeAssetIds: ['image'],
    channels: tiktok || mode === 'video' ? ['TIKTOK'] : ['FACEBOOK'],
    productId: 'product',
    campaignName: '',
    date: '',
  },
  new Date(),
  () => 'fixture',
)[0]!;
let calls = 0;
let phase = 'CREATE_PUBLICATION_ATTEMPT';
const operations = createEditorialOperations(
  {
    functions: {
      invoke: async <T,>(
        _name: string,
        { body }: { body: { action: string; payload?: Record<string, unknown> } },
      ) => {
        calls++;
        document.body.dataset.calls = String(calls);
        const choices = body.payload?.tiktokChoices;
        if (body.action === 'READ_TIKTOK_CREATOR_INFO') return { error: null, data: { externalPublication: false, data: { creator, context: 'fixture-context' } as T } };
        if (body.action === 'ASSESS_PUBLICATION_OPERATION')
          return {
            error: null,
            data: {
              externalPublication: false,
              data: {
                snapshot: phase,
                preparedPublicationId: item.publication.id,
                productId: 'product',
                channel: tiktok ? 'TIKTOK' : 'FACEBOOK',
                copy: item.publication.copy,
                callToAction: '',
                hashtags: [],
                creativeAssetIds: ['image'],
                attemptId: phase === 'CREATE_PUBLICATION_ATTEMPT' ? null : 'fixture-attempt',
                nextAction: phase === 'DONE' || (tiktok && !choices) ? null : phase,
                blockers:
                  phase === 'DONE'
                    ? ['ATTEMPT_REQUIRES_RECONCILIATION_NO_RETRY']
                    : tiktok && !choices
                      ? ['TIKTOK_EXPLICIT_CHOICES_REQUIRED']
                      : [],
                ...(tiktok
                  ? {
                      tiktokCreator: body.payload?.tiktokCreatorContext === 'fixture-context' ? creator : null,
                      tiktokCreatorContext: body.payload?.tiktokCreatorContext ?? null,
                      tiktokChoices: choices ?? null,
                    }
                  : {}),
                assessedAt: '2026-09-28',
                executionAllowed: false,
              } as T,
            },
          };
        if (body.action === 'CREATE_PUBLICATION_ATTEMPT') phase = 'EXECUTE_PUBLICATION_ATTEMPT';
        else phase = 'DONE';
        return {
          error: null,
          data: {
            data: { status: phase } as T,
            externalPublication: body.action === 'EXECUTE_PUBLICATION_ATTEMPT',
          },
        };
      },
    },
  },
  true,
);
function Fixture() {
  const [busy, setBusy] = useState(false);
  if (mode === 'video')
    return (
      <MemoryRouter>
        <EditorialComposer
          item={item}
          products={[]}
          busy={false}
          readVideos={async () => [
            {
              id: 'durable-video',
              productId: 'product',
              publicUrl: 'https://example.invalid/video.mp4',
              mimeType: 'video/mp4',
            },
          ]}
          onClose={() => {}}
          onSave={async (draft) => {
            const saved = createEditorialDraft(draft, new Date(), () => 'saved')[0]!;
            const restored = await resolveProductAssociationsFromMedia(
              [{ ...saved, productId: '' }],
              [{ id: 'product' }],
              async () => [],
              async () => [{ id: 'durable-video' }],
            );
            document.body.dataset.savedVideo = saved.publication.creativeAssetIds.join(',');
            document.body.dataset.restoredProduct = restored[0]!.productId;
          }}
        />
      </MemoryRouter>
    );
  return (
    <EditorialOperationalActions
      item={item}
      disabled={busy}
      onBusyChange={setBusy}
      operations={() => operations}
      onRefresh={async () => {
        document.body.dataset.refreshed = phase;
      }}
    />
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
