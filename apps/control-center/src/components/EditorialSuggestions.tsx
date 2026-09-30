import { useEffect, useRef, useState } from 'react';
import type { ProductListItemDTO } from '@lihen/products';
import type { EditorialDraft } from '../composition/editorial-workspace';
import type { EditorialChannel } from '../domain/editorial-planning';
import { editorialIdentityKey } from '@lihen/intelligence-core';
import { identifyProduct } from '../composition/editorial-grounding';
import {
  EditorialIntelligenceUnavailable,
  suggestEditorialContent,
  type EditorialSuggestionField,
  type EditorialSuggestionTarget,
  type EditorialRecommendation,
} from '../composition/editorial-intelligence';

interface Suggestion {
  text: string;
  status: 'Sugerencia lista' | 'Usada/editada por operadora';
  grounding: Pick<EditorialRecommendation, 'productIdentity' | 'evidence'>;
}
type Suggestions = Record<string, Suggestion>;
const suggestionKey = (field: EditorialSuggestionField, channel: EditorialChannel) =>
  field === 'campaignName' ? field : `${channel}:${field}`;

export function useEditorialSuggestions({
  product,
  draft,
  channel,
}: {
  product: ProductListItemDTO | undefined;
  draft: EditorialDraft;
  channel: EditorialChannel;
}) {
  const [suggestions, setSuggestions] = useState<Suggestions>({});
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const request = useRef(0);
  const identityKey = product ? editorialIdentityKey(identifyProduct(product)) : draft.productId;
  const currentContext = `${identityKey}:${draft.channels.join(',')}`;
  const contextRef = useRef(currentContext);
  contextRef.current = currentContext;
  useEffect(() => {
    request.current++;
    setSuggestions({});
    setNotice('');
    setPending(false);
    return () => {
      request.current++;
    };
  }, [identityKey]);
  useEffect(() => {
    request.current++;
    setPending(false);
    setNotice('');
    setSuggestions((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) =>
            key === 'campaignName' || draft.channels.some((entry) => key.startsWith(`${entry}:`)),
        ),
      ),
    );
  }, [draft.channels.join(',')]);

  async function generate(target: EditorialSuggestionTarget) {
    if (!product || !draft.channels.length || pending) return;
    const generation = ++request.current;
    const context = currentContext;
    setPending(true);
    setNotice('Generando…');
    try {
      const response = await suggestEditorialContent({
        product,
        draft,
        channels: target === 'all' ? [...draft.channels] : [channel],
        target,
      });
      if (generation !== request.current || context !== contextRef.current) return;
      setSuggestions((previous) => {
        const next = { ...previous };
        const grounding = {
          productIdentity: response.productIdentity,
          evidence: response.evidence,
        };
        if (target === 'all' || target === 'campaignName')
          next.campaignName = {
            text: response.campaignName,
            status: 'Sugerencia lista',
            grounding,
          };
        for (const variant of response.variants) {
          for (const field of ['copy', 'callToAction', 'hashtags'] as const) {
            if (target === 'all' || target === field)
              next[suggestionKey(field, variant.channel)] = {
                text: field === 'hashtags' ? variant.hashtags.join(' ') : variant[field],
                status: 'Sugerencia lista',
                grounding,
              };
          }
        }
        return next;
      });
      setNotice('Sugerencia lista. Revisa las propuestas en cada pestaña antes de usarlas.');
    } catch (error) {
      if (generation !== request.current || context !== contextRef.current) return;
      setNotice(
        error instanceof EditorialIntelligenceUnavailable
          ? 'No disponible. Puedes continuar editando manualmente y guardar el borrador.'
          : 'Error al generar. Puedes reintentar o continuar editando manualmente y guardar el borrador.',
      );
    } finally {
      if (generation === request.current) setPending(false);
    }
  }
  function discard(field: EditorialSuggestionField) {
    setSuggestions((current) => {
      const next = { ...current };
      delete next[suggestionKey(field, channel)];
      return next;
    });
    setNotice('Sugerencia descartada. El borrador conserva su contenido.');
  }
  function used(field: EditorialSuggestionField) {
    setSuggestions((current) => {
      const key = suggestionKey(field, channel);
      const entry = current[key];
      return entry
        ? { ...current, [key]: { ...entry, status: 'Usada/editada por operadora' } }
        : current;
    });
    setNotice('Usada/editada por operadora. El contenido sigue siendo un borrador.');
  }
  return {
    generate,
    discard,
    used,
    pending,
    notice,
    disabled: !product || !draft.channels.length || pending,
    get: (field: EditorialSuggestionField) => suggestions[suggestionKey(field, channel)],
  };
}

export function EditorialSuggestion({
  field,
  label,
  currentValue,
  suggestions,
  onUse,
}: {
  field: EditorialSuggestionField;
  label: string;
  currentValue: string;
  suggestions: ReturnType<typeof useEditorialSuggestions>;
  onUse: (text: string) => void;
}) {
  const suggestion = suggestions.get(field);
  return (
    <div className="editorial-suggestion" role="group" aria-label={`Recomendación de ${label}`}>
      <button
        type="button"
        className="button-ghost"
        disabled={suggestions.disabled}
        onClick={() => void suggestions.generate(field)}
      >
        {field === 'campaignName'
          ? 'Sugerir con LIHEN Intelligence'
          : field === 'copy'
            ? 'Sugerir copy con LIHEN Intelligence'
            : `Sugerir ${label}`}
      </button>
      {suggestion && (
        <div className="info-state">
          <small>{suggestion.status} · Propuesta de LIHEN Intelligence</small>
          <p className="editorial-suggestion-text">
            {suggestion.text || 'Sin hashtags para esta propuesta.'}
          </p>
          <EditorialSources grounding={suggestion.grounding} />
          {suggestion.status === 'Sugerencia lista' && (
            <>
              {currentValue.trim() && (
                <p>
                  Ya escribiste contenido. Usar esta sugerencia reemplazará únicamente este campo.
                </p>
              )}
              <button
                type="button"
                disabled={suggestions.pending}
                onClick={() => {
                  onUse(suggestion.text);
                  suggestions.used(field);
                }}
              >
                {currentValue.trim() ? 'Reemplazar este campo con sugerencia' : 'Usar sugerencia'}
              </button>
            </>
          )}
          <button
            type="button"
            className="button-ghost"
            disabled={suggestions.disabled}
            onClick={() => void suggestions.generate(field)}
          >
            Regenerar
          </button>
          <button
            type="button"
            className="button-ghost"
            disabled={suggestions.pending}
            onClick={() => suggestions.discard(field)}
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}

function EditorialSources({ grounding }: { grounding: Suggestion['grounding'] }) {
  const { productIdentity: identity, evidence } = grounding;
  const facts = [
    ...evidence.internalFacts,
    ...evidence.officialBrandFacts,
    ...evidence.secondaryFacts,
  ];
  return (
    <details className="editorial-sources">
      <summary>
        Basado en{' '}
        {evidence.sources.filter((source) => source.trust !== 'INSUFFICIENT_EVIDENCE').length}{' '}
        fuentes · Ver fuentes
      </summary>
      <p>
        <strong>Información verificada utilizada para esta propuesta</strong>
      </p>
      <p>
        {identity.productName} · SKU: {identity.sku ?? 'No registrado'} · Marca:{' '}
        {identity.brand ?? 'No registrada'}
      </p>
      <p>Producto: {identity.productId}</p>
      <p>GENERATED != VERIFIED · La propuesta no es un hecho ni contenido oficial.</p>
      <ul>
        {evidence.sources.map((source) => (
          <li key={source.id}>
            {source.label} · {source.trust} · Consultado: {source.retrievedAt}
            {source.verification && (
              <p>
                {source.verification.domain} · {source.verification.authority} ·{' '}
                {source.verification.identityMatch} · {source.verification.authorityReason}
              </p>
            )}
            {source.url && (
              <>
                {' '}
                ·{' '}
                <a href={source.url} target="_blank" rel="noreferrer">
                  Abrir fuente
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
      <ul>
        {facts.map((fact) => (
          <li key={fact.id}>
            {fact.field}: {fact.value} · {fact.trust} ·{' '}
            {evidence.sources.find((source) => source.id === fact.sourceId)?.label}
            {evidence.usedFactIds.includes(fact.id)
              ? ' · Utilizado en la propuesta generada'
              : ' · Contexto consultado; no utilizado como afirmación'}
            {fact.evidenceRefs && <span> · Evidencia: {fact.evidenceRefs.join(', ')}</span>}
          </li>
        ))}
      </ul>
      <p>
        GENERAL_EDITORIAL_CONTEXT: estilo y estructura neutral; no demuestra propiedades del
        producto.
      </p>
      <p>
        {evidence.externalResearch === 'NOT_CONFIGURED'
          ? 'Investigación web no configurada. La recomendación utiliza únicamente evidencia interna verificada.'
          : evidence.externalResearch === 'COMPLETED'
            ? 'Solo las fuentes verificadas pueden respaldar afirmaciones. Las fuentes secundarias conservan su clasificación.'
            : 'Investigación externa sin evidencia suficiente. Se conserva la evidencia interna.'}
      </p>
      {evidence.research && (
        <small>
          {evidence.research.status} · {evidence.research.evidenceStatus}
        </small>
      )}
      <p>
        INSUFFICIENT_EVIDENCE: {evidence.unsupportedClaims.map((claim) => claim.field).join(', ')}.
        No se permiten afirmaciones sobre estos datos ausentes.
      </p>
    </details>
  );
}
