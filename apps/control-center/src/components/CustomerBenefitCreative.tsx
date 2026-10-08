import * as CouponReact from 'react';
import {
  useState,
  type CSSProperties,
} from 'react';

import type {
  Customer,
} from '@lihen/customer';

import {
  auditLihenCreativeRequest,
  LIHEN_BRAND_CONTEXT,
} from '@lihen/intelligence-core';

import { createBenefitPng as createReferenceBenefitPng } from './customer-benefit-reference-canvas';

import {
  buildCustomerBenefitMessage,
  buildCustomerBenefitVisualModel,
  customerBenefitImageFileName,
  customerBenefitWhatsAppUrl,
  type CustomerBenefitCreativeInput,
} from '../domain/customer-benefit-creative';


interface CustomerBenefitCreativeProps {
  readonly benefit:
    CustomerBenefitCreativeInput;

  readonly customer:
    Customer | null;
}


function downloadBlob(
  blob:
    Blob,

  fileName:
    string,
) {
  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      'a',
    );

  anchor.href =
    url;

  anchor.download =
    fileName;

  anchor.click();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url,
      ),
    1000,
  );
}



type CustomerBenefitPreviewInput =
  Parameters<
    typeof buildCustomerBenefitVisualModel
  >[0];


function CustomerBenefitReferencePreview(
  {
    benefit,
    visualStyle,
  }:
  {
    readonly benefit:
      CustomerBenefitPreviewInput;

    readonly visualStyle:
      CouponReact.CSSProperties;
  },
) {
  const model =
    buildCustomerBenefitVisualModel(
      benefit,
    );

  const [
    previewUrl,
    setPreviewUrl,
  ] =
    CouponReact.useState<
      string | null
    >(null);

  const [
    previewError,
    setPreviewError,
  ] =
    CouponReact.useState<
      string | null
    >(null);


  CouponReact.useEffect(
    () => {
      let active =
        true;

      let objectUrl:
        string | null =
          null;

      setPreviewUrl(
        null,
      );

      setPreviewError(
        null,
      );


      void createReferenceBenefitPng(
        benefit,
      )
        .then(
          (blob) => {
            if (!active) {
              return;
            }

            objectUrl =
              URL.createObjectURL(
                blob,
              );

            setPreviewUrl(
              objectUrl,
            );
          },
        )
        .catch(
          () => {
            if (!active) {
              return;
            }

            setPreviewError(
              'No fue posible generar la vista previa del bono.',
            );
          },
        );


      return () => {
        active =
          false;

        if (objectUrl) {
          URL.revokeObjectURL(
            objectUrl,
          );
        }
      };
    },
    [benefit],
  );


  return (
    <figure
      className="benefit-reference-card"
      style={visualStyle}
      data-customer-benefit-reference-preview="true"
      data-layout-contract="brand-header script-headline intro-copy discount-ticket exclusive-code validity-benefit closing brand-footer"
    >
      {previewUrl ? (
        <img
          className="benefit-reference-card__image"
          src={previewUrl}
          alt={
            `Bono LIHEN ${model.lineLabel}: ` +
            `${model.discountLabel}, código ${model.codeLabel}`
          }
        />
      ) : null}

      {!previewUrl && !previewError ? (
        <div
          className="benefit-reference-card__loading"
          aria-live="polite"
        >
          Preparando bono LIHEN…
        </div>
      ) : null}

      {previewError ? (
        <div
          className="benefit-reference-card__error"
          role="alert"
        >
          {previewError}
        </div>
      ) : null}
    </figure>
  );
}


export function CustomerBenefitCreative({
  benefit,
  customer,
}: CustomerBenefitCreativeProps) {
  const [
    feedback,
    setFeedback,
  ] =
    useState('');

  const [
    busy,
    setBusy,
  ] =
    useState(false);


  const visual =
    buildCustomerBenefitVisualModel(
      benefit,
    );

  const brandAudit =
    auditLihenCreativeRequest({
      instruction:
        `Render ${visual.typeLabel} for ${visual.lineLabel} using the official LIHEN brand identity.`,
      intendedUse:
        'CUSTOMER_BENEFIT_SHARE',
      businessLine:
        benefit.business_line,
      logoObservation:
        'OFFICIAL_ASSET_BACKGROUND_NEUTRALIZED',
    });

  const message =
    buildCustomerBenefitMessage(
      benefit,
      customer,
    );

  const fileName =
    customerBenefitImageFileName(
      benefit,
    );

  const theme =
    visual.themeTokens;


  const visualStyle = {
    '--benefit-start':
      theme.start,

    '--benefit-middle':
      theme.middle,

    '--benefit-end':
      theme.end,

    '--benefit-accent':
      theme.accent,

    '--benefit-accent-soft':
      theme.accentSoft,

    '--benefit-text':
      theme.text,

    '--benefit-muted':
      theme.muted,

    '--benefit-border':
      theme.border,

    '--benefit-glow':
      theme.glow,

    '--benefit-lime':
      theme.limeGlow,

    '--benefit-code-surface':
      theme.codeSurface,

    '--benefit-status-surface':
      theme.statusSurface,
  } as CSSProperties;


  async function copyMessage() {
    try {
      await navigator
        .clipboard
        .writeText(
          message,
        );

      setFeedback(
        'Mensaje copiado. Ya puedes pegarlo en WhatsApp.',
      );
    } catch {
      setFeedback(
        'No fue posible copiar automáticamente. Selecciona el texto manualmente.',
      );
    }
  }


  async function downloadImage() {
    setBusy(true);
    setFeedback('');

    try {
      const blob =
        await createReferenceBenefitPng(
          benefit,
        );

      downloadBlob(
        blob,
        fileName,
      );

      setFeedback(
        'Imagen PNG generada y descargada.',
      );
    } catch (cause) {
      setFeedback(
        cause instanceof Error
          ? cause.message
          : 'No fue posible generar la imagen.',
      );
    } finally {
      setBusy(false);
    }
  }


  async function shareImage() {
    setBusy(true);
    setFeedback('');

    try {
      const blob =
        await createReferenceBenefitPng(
          benefit,
        );

      const file =
        new File(
          [blob],
          fileName,
          {
            type:
              'image/png',
          },
        );

      if (
        typeof navigator.share ===
          'function' &&
        typeof navigator.canShare ===
          'function' &&
        navigator.canShare({
          files: [file],
        })
      ) {
        await navigator.share({
          files: [file],
          title:
            `${visual.typeLabel} · LIHEN.CO`,
        });

        setFeedback(
          'Imagen compartida desde el navegador.',
        );

        return;
      }

      downloadBlob(
        blob,
        fileName,
      );

      setFeedback(
        'Este navegador no comparte archivos directamente. La imagen fue descargada para compartirla manualmente.',
      );
    } catch (cause) {
      if (
        cause instanceof DOMException &&
        cause.name ===
          'AbortError'
      ) {
        setFeedback(
          'Compartir imagen fue cancelado.',
        );
      } else {
        setFeedback(
          cause instanceof Error
            ? cause.message
            : 'No fue posible compartir la imagen.',
        );
      }
    } finally {
      setBusy(false);
    }
  }


  function openWhatsApp() {
    const url =
      customerBenefitWhatsAppUrl(
        message,
        customer,
      );

    window.open(
      url,
      '_blank',
      'noopener,noreferrer',
    );

    setFeedback(
      'WhatsApp abierto con texto preparado. La imagen debe compartirse por separado.',
    );
  }


  return (
    <div className="benefit-creative-layout">
      <CustomerBenefitReferencePreview
        benefit={benefit}
        visualStyle={visualStyle}
      />


      <section className="card stack benefit-share-panel">
        <section
          className="benefit-operator-qa"
          aria-label="Creative QA"
        >
          <div className="benefit-operator-qa__heading">
            <div>
              <span className="benefit-operator-eyebrow">
                Creative QA
              </span>

              <strong>
                Control de marca y ejecución
              </strong>
            </div>

            <span className="benefit-operator-qa__ready">
              READY
            </span>
          </div>

          <div className="benefit-operator-qa__brand">
            <span>Brand</span>
            <strong>{LIHEN_BRAND_CONTEXT.brand}</strong>
          </div>

          <div className="benefit-operator-qa__statuses">
            <div className="benefit-operator-status">
              <span
                className="benefit-operator-status__icon"
                aria-hidden="true"
              >
                ✓
              </span>

              <div>
                <span>Brand check</span>

                <strong className="benefit-operator-badge benefit-operator-badge--pass">
                  {brandAudit.overall}
                </strong>
              </div>
            </div>

            <div className="benefit-operator-status">
              <span
                className="benefit-operator-status__icon"
                aria-hidden="true"
              >
                ✓
              </span>

              <div>
                <span>Logo integrity</span>

                <strong className="benefit-operator-badge benefit-operator-badge--pass">
                  {brandAudit.logoIntegrity}
                </strong>
              </div>
            </div>

            <div className="benefit-operator-status">
              <span
                className="benefit-operator-status__icon benefit-operator-status__icon--prepared"
                aria-hidden="true"
              >
                ◇
              </span>

              <div>
                <span>Execution</span>

                <strong
                  className="benefit-operator-badge benefit-operator-badge--prepared"
                  data-execution-state={brandAudit.executionState}
                >
                  {brandAudit.executionState === 'PREPARED_ONLY'
                    ? 'PREPARED ONLY'
                    : brandAudit.executionState}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <div className="benefit-share-panel__heading">
          <span className="eyebrow">
            COMPARTIR CON CLIENTE
          </span>

          <h3>
            Un detalle preparado para compartir
          </h3>

          <p>
            La imagen y el mensaje permanecen bajo tu control.
            LIHEN no envía automáticamente ninguna pieza.
          </p>
        </div>


        {benefit.status !==
        'ACTIVE' ? (
          <div className="benefit-share-warning">
            <strong>
              {visual.statusLabel}
            </strong>

            <span>
              La pieza puede conservarse como histórico,
              pero verifica el lifecycle antes de presentarla
              como beneficio utilizable.
            </span>
          </div>
        ) : null}


        <div
          className="benefit-share-workflow"
          aria-label="Flujo para compartir con cliente"
        >
          <article className="benefit-share-step">
            <div className="benefit-share-step__topline">
              <span className="benefit-share-step__number">01</span>
              <span className="benefit-share-step__icon" aria-hidden="true">✦</span>
            </div>

            <strong>Imagen</strong>
            <p>Comparte o descarga el PNG.</p>
          </article>

          <article className="benefit-share-step">
            <div className="benefit-share-step__topline">
              <span className="benefit-share-step__number">02</span>
              <span className="benefit-share-step__icon" aria-hidden="true">◇</span>
            </div>

            <strong>Mensaje</strong>
            <p>Copia el texto preparado.</p>
          </article>

          <article className="benefit-share-step">
            <div className="benefit-share-step__topline">
              <span className="benefit-share-step__number">03</span>
              <span className="benefit-share-step__icon" aria-hidden="true">↗</span>
            </div>

            <strong>WhatsApp</strong>
            <p>Abre el chat y decide si deseas enviarlo.</p>
          </article>
        </div>


        <section className="benefit-share-message">
          <div className="benefit-share-message__heading">
            <span className="benefit-operator-eyebrow">
              MENSAJE SUGERIDO
            </span>

            <span className="benefit-share-message__status">
              PREPARADO
            </span>
          </div>

          <label className="benefit-message-block">
            <span className="sr-only">
              Mensaje sugerido para WhatsApp
            </span>

            <textarea
              className="benefit-message-preview benefit-share-message__textarea"
              readOnly
              value={message}
              aria-label="Mensaje sugerido para WhatsApp"
            />
          </label>

          <p className="benefit-share-message__note">
            El mensaje no se envía automáticamente.
          </p>
        </section>


        <div className="benefit-share-actions">
          <button
            className="benefit-share-action benefit-share-action--primary"
            type="button"
            disabled={busy}
            onClick={() =>
              void shareImage()
            }
          >
            Compartir imagen
          </button>

          <button
            className="benefit-share-action benefit-share-action--secondary"
            type="button"
            disabled={busy}
            onClick={() =>
              void downloadImage()
            }
          >
            Descargar PNG
          </button>

          <button
            className="benefit-share-action benefit-share-action--secondary"
            type="button"
            onClick={() =>
              void copyMessage()
            }
          >
            Copiar mensaje
          </button>

          <button
            className="benefit-share-action benefit-share-action--outbound"
            type="button"
            onClick={
              openWhatsApp
            }
          >
            Abrir WhatsApp
          </button>
        </div>


        {feedback ? (
          <div
            className="success-state"
            role="status"
          >
            {feedback}
          </div>
        ) : null}
      </section>
    </div>
  );
}
