import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorialScheduling } from '../../src/components/EditorialScheduling';
import {
  createEditorialDraft,
  programEditorial,
  reviewEditorial,
} from '../../src/composition/editorial-workspace';
import type { EditorialItem } from '../../src/domain/editorial-planning';

// Local interaction fixture only. No provider or DEV network client is constructed.
const now = new Date('2026-09-29T16:00:00Z');
let sequence = 0;
const initial = createEditorialDraft(
  {
    copy: 'Beauty Care',
    callToAction: 'Conoce',
    hashtags: '#LIHEN',
    creativeAssetIds: ['durable-video'],
    channels: ['TIKTOK'],
    productId: 'product',
    campaignName: '',
    date: '',
  },
  now,
  () => String(++sequence),
)[0]!;
const mode = new URLSearchParams(location.search).get('mode');
function Fixture() {
  const [item, setItem] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<EditorialItem | null>(null);
  return (
    <main>
      {item.publication.status === 'PREPARED' && (
        <button
          onClick={async () => setItem(await reviewEditorial(item, 'SUBMIT_FOR_REVIEW', now))}
        >
          Enviar a revisión
        </button>
      )}
      {item.publication.status === 'IN_REVIEW' && (
        <button onClick={async () => setItem(await reviewEditorial(item, 'APPROVE', now))}>
          Aprobar contenido
        </button>
      )}
      <EditorialScheduling
        key={item.publication.status + item.schedule?.status}
        item={item}
        productName="Beauty Care"
        now={now}
        disabled={busy}
        onSchedule={async (date) => {
          setBusy(true);
          document.body.dataset.scheduleCalls = String(
            Number(document.body.dataset.scheduleCalls ?? 0) + 1,
          );
          const next = await programEditorial(item, date, now, () => String(++sequence));
          if (mode === 'failure') {
            setError('DEV no confirmó el estado solicitado.');
            setBusy(false);
          } else setPending(next);
        }}
      />
      {pending && (
        <button
          onClick={() => {
            setItem(pending);
            setPending(null);
            setBusy(false);
          }}
        >
          Simular confirmación durable
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <output aria-label="Intentos">{item.attempts.length}</output>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
