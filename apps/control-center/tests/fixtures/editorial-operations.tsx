// Browser fixture only. Never imported by the application; no network client.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorialOperationalActions } from '../../src/components/EditorialOperationalActions';
import { createEditorialDraft } from '../../src/composition/editorial-workspace';
import { createEditorialOperations } from '../../src/composition/editorial-operations';

const item = createEditorialDraft(
  {
    copy: 'Contenido de prueba local',
    callToAction: '',
    hashtags: '',
    creativeAssetIds: ['image'],
    channels: ['FACEBOOK'],
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
      invoke: async <T,>(_name: string, { body }: { body: { action: string } }) => {
        calls++;
        document.body.dataset.calls = String(calls);
        if (body.action === 'ASSESS_PUBLICATION_OPERATION')
          return {
            error: null,
            data: {
              externalPublication: false,
              data: {
                snapshot: phase,
                preparedPublicationId: item.publication.id,
                productId: 'product',
                channel: 'FACEBOOK',
                copy: item.publication.copy,
                callToAction: '',
                hashtags: [],
                creativeAssetIds: ['image'],
                attemptId: phase === 'CREATE_PUBLICATION_ATTEMPT' ? null : 'fixture-attempt',
                nextAction: phase === 'DONE' ? null : phase,
                blockers: phase === 'DONE' ? ['ATTEMPT_REQUIRES_RECONCILIATION_NO_RETRY'] : [],
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
