import {
  useState,
  type CSSProperties,
} from 'react';

import type {
  Customer,
} from '@lihen/customer';

import logo from '../assets/brand/lihen-logo-official.png';

import {
  buildCustomerBenefitMessage,
  buildCustomerBenefitVisualModel,
  customerBenefitImageFileName,
  customerBenefitWhatsAppUrl,
  type CustomerBenefitCreativeInput,
  type CustomerBenefitCreativeTheme,
} from '../domain/customer-benefit-creative';


interface CustomerBenefitCreativeProps {
  readonly benefit:
    CustomerBenefitCreativeInput;

  readonly customer:
    Customer | null;
}


function loadImage(
  src: string,
) {
  return new Promise<
    HTMLImageElement
  >(
    (
      resolve,
      reject,
    ) => {
      const image =
        new Image();

      image.onload =
        () => resolve(image);

      image.onerror =
        () => reject(
          new Error(
            'No fue posible cargar el logo oficial de LIHEN.',
          ),
        );

      image.src =
        src;
    },
  );
}


function wrapCanvasText(
  context:
    CanvasRenderingContext2D,

  text:
    string,

  x:
    number,

  y:
    number,

  maxWidth:
    number,

  lineHeight:
    number,
) {
  const words =
    text.split(/\s+/);

  let line =
    '';

  let nextY =
    y;

  for (
    const word
    of words
  ) {
    const candidate =
      line
        ? `${line} ${word}`
        : word;

    if (
      context
        .measureText(
          candidate,
        )
        .width >
        maxWidth &&
      line
    ) {
      context.fillText(
        line,
        x,
        nextY,
      );

      line =
        word;

      nextY +=
        lineHeight;
    } else {
      line =
        candidate;
    }
  }

  if (line) {
    context.fillText(
      line,
      x,
      nextY,
    );
  }
}


function roundedRect(
  context:
    CanvasRenderingContext2D,

  x:
    number,

  y:
    number,

  width:
    number,

  height:
    number,

  radius:
    number,
) {
  const r =
    Math.min(
      radius,
      width / 2,
      height / 2,
    );

  context.beginPath();

  context.moveTo(
    x + r,
    y,
  );

  context.lineTo(
    x + width - r,
    y,
  );

  context.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + r,
  );

  context.lineTo(
    x + width,
    y + height - r,
  );

  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height,
  );

  context.lineTo(
    x + r,
    y + height,
  );

  context.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - r,
  );

  context.lineTo(
    x,
    y + r,
  );

  context.quadraticCurveTo(
    x,
    y,
    x + r,
    y,
  );

  context.closePath();
}


function drawSoftBlob(
  context:
    CanvasRenderingContext2D,

  x:
    number,

  y:
    number,

  radiusX:
    number,

  radiusY:
    number,

  color:
    string,

  alpha:
    number,
) {
  context.save();

  context.globalAlpha =
    alpha;

  context.filter =
    'blur(48px)';

  context.fillStyle =
    color;

  context.beginPath();

  context.ellipse(
    x,
    y,
    radiusX,
    radiusY,
    0,
    0,
    Math.PI * 2,
  );

  context.fill();

  context.restore();
}


function drawOrganicContours(
  context:
    CanvasRenderingContext2D,

  theme:
    CustomerBenefitCreativeTheme,
) {
  context.save();

  context.strokeStyle =
    theme.contour;

  context.globalAlpha =
    0.46;

  context.lineWidth =
    3;

  for (
    let index = 0;
    index < 5;
    index += 1
  ) {
    const inset =
      index * 20;

    context.beginPath();

    context.bezierCurveTo(
      230 + inset,
      245 + inset,
      390 - inset,
      165 + inset,
      520,
      245 + inset,
    );

    context.bezierCurveTo(
      700 + inset,
      340 - inset,
      880 - inset,
      210 + inset,
      895 - inset,
      345 + inset,
    );

    context.stroke();
  }

  context.restore();
}


async function createBenefitPng(
  benefit:
    CustomerBenefitCreativeInput,
) {
  const model =
    buildCustomerBenefitVisualModel(
      benefit,
    );

  const theme =
    model.themeTokens;

  const canvas =
    document.createElement(
      'canvas',
    );

  canvas.width =
    1080;

  canvas.height =
    1350;

  const context =
    canvas.getContext(
      '2d',
    );

  if (!context) {
    throw new Error(
      'El navegador no permite generar la imagen del bono.',
    );
  }


  const background =
    context.createLinearGradient(
      0,
      0,
      1080,
      1350,
    );

  background.addColorStop(
    0,
    theme.start,
  );

  background.addColorStop(
    0.52,
    theme.middle,
  );

  background.addColorStop(
    1,
    theme.end,
  );

  context.fillStyle =
    background;

  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height,
  );


  drawSoftBlob(
    context,
    185,
    230,
    230,
    180,
    theme.glow,
    0.47,
  );

  drawSoftBlob(
    context,
    915,
    330,
    250,
    210,
    theme.limeGlow,
    0.34,
  );

  drawSoftBlob(
    context,
    815,
    1160,
    270,
    160,
    theme.accentSoft,
    0.37,
  );

  drawOrganicContours(
    context,
    theme,
  );


  context.strokeStyle =
    theme.border;

  context.globalAlpha =
    0.58;

  context.lineWidth =
    2;

  roundedRect(
    context,
    48,
    48,
    984,
    1254,
    50,
  );

  context.stroke();

  context.globalAlpha =
    1;


  const officialLogo =
    await loadImage(
      logo,
    );

  const logoWidth =
    220;

  const logoRatio =
    officialLogo.height /
    officialLogo.width;

  context.drawImage(
    officialLogo,
    (
      canvas.width -
      logoWidth
    ) / 2,
    88,
    logoWidth,
    logoWidth *
      logoRatio,
  );


  context.textAlign =
    'center';


  context.fillStyle =
    theme.accent;

  context.font =
    '700 27px Arial, sans-serif';

  context.fillText(
    model.lineLabel
      .toUpperCase(),
    540,
    370,
  );


  context.fillStyle =
    theme.muted;

  context.font =
    'italic 28px Georgia, serif';

  context.fillText(
    model.emotionalCopy,
    540,
    430,
  );


  context.fillStyle =
    theme.text;

  context.font =
    '700 51px Georgia, serif';

  context.fillText(
    model.typeLabel,
    540,
    510,
  );


  /*
   * The number and percentage sign remain one Canvas text token.
   * This is the anti-overlap contract.
   */
  context.fillStyle =
    theme.accent;

  context.font =
    '700 170px Georgia, serif';

  context.fillText(
    model.discountLabel,
    540,
    715,
  );


  roundedRect(
    context,
    270,
    780,
    540,
    118,
    28,
  );

  context.fillStyle =
    'rgba(255,255,255,.62)';

  context.fill();

  context.strokeStyle =
    theme.border;

  context.globalAlpha =
    0.42;

  context.stroke();

  context.globalAlpha =
    1;


  context.fillStyle =
    theme.muted;

  context.font =
    '700 18px Arial, sans-serif';

  context.fillText(
    'TU CÓDIGO',
    540,
    818,
  );

  context.fillStyle =
    theme.text;

  context.font =
    '700 31px Arial, sans-serif';

  context.fillText(
    model.codeLabel,
    540,
    862,
  );


  context.fillStyle =
    theme.muted;

  context.font =
    '700 18px Arial, sans-serif';

  context.fillText(
    'VÁLIDO HASTA',
    540,
    958,
  );

  context.fillStyle =
    theme.text;

  context.font =
    '700 31px Georgia, serif';

  context.fillText(
    model.validityValue,
    540,
    1000,
  );


  roundedRect(
    context,
    455,
    1032,
    170,
    48,
    24,
  );

  context.fillStyle =
    'rgba(255,255,255,.58)';

  context.fill();

  context.fillStyle =
    theme.accent;

  context.font =
    '700 17px Arial, sans-serif';

  context.fillText(
    model.statusLabel
      .toUpperCase(),
    540,
    1063,
  );


  context.fillStyle =
    theme.muted;

  context.font =
    '500 25px Arial, sans-serif';

  wrapCanvasText(
    context,
    model.cta,
    540,
    1136,
    760,
    34,
  );


  context.fillStyle =
    theme.accent;

  context.font =
    '700 25px Georgia, serif';

  context.fillText(
    '✨ LIHEN.CO | Beauty Care • Style',
    540,
    1232,
  );


  context.fillStyle =
    theme.muted;

  context.font =
    'italic 23px Georgia, serif';

  context.fillText(
    'Tu cuidado, tu estilo, tu esencia.',
    540,
    1272,
  );


  const blob =
    await new Promise<
      Blob
    >(
      (
        resolve,
        reject,
      ) => {
        canvas.toBlob(
          (
            result,
          ) => {
            if (result) {
              resolve(
                result,
              );
            } else {
              reject(
                new Error(
                  'No fue posible convertir el bono a PNG.',
                ),
              );
            }
          },
          'image/png',
        );
      },
    );

  return blob;
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
        await createBenefitPng(
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
        await createBenefitPng(
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
      <section
        className={
          `benefit-visual benefit-visual--${visual.theme} ` +
          `benefit-visual--${benefit.status.toLowerCase()}`
        }
        style={visualStyle}
        aria-label={`Vista del bono ${benefit.benefit_code}`}
      >
        <div
          className="benefit-visual__orb benefit-visual__orb--one"
          aria-hidden="true"
        />

        <div
          className="benefit-visual__orb benefit-visual__orb--two"
          aria-hidden="true"
        />

        <div
          className="benefit-visual__contours"
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
          <i />
        </div>

        <div className="benefit-visual__brand-aura">
          <img
            className="benefit-visual__logo"
            src={logo}
            alt="LIHEN"
          />
        </div>

        <span className="benefit-visual__line">
          {visual.lineLabel}
        </span>

        <p className="benefit-visual__emotion">
          {visual.emotionalCopy}
        </p>

        <h3>
          {visual.typeLabel}
        </h3>

        <strong
          className="benefit-visual__discount"
          data-layout-contract="single-token-percentage"
        >
          {visual.discountLabel}
        </strong>

        <div className="benefit-visual__code">
          <span>Tu código</span>
          <strong>
            {visual.codeLabel}
          </strong>
        </div>

        <div className="benefit-visual__validity">
          <span>
            Válido hasta
          </span>

          <strong>
            {visual.validityValue}
          </strong>
        </div>

        <span className="benefit-visual__status">
          {visual.statusLabel}
        </span>

        <p className="benefit-visual__cta">
          {visual.cta}
        </p>

        <footer>
          <strong>
            ✨ LIHEN.CO | Beauty Care • Style
          </strong>

          <span>
            Tu cuidado, tu estilo, tu esencia.
          </span>
        </footer>
      </section>


      <section className="card stack benefit-share-panel">
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


        <div className="benefit-share-steps">
          <div>
            <span>01</span>

            <p>
              <strong>
                Imagen
              </strong>

              <small>
                Comparte o descarga el PNG.
              </small>
            </p>
          </div>

          <div>
            <span>02</span>

            <p>
              <strong>
                Mensaje
              </strong>

              <small>
                Copia el texto preparado.
              </small>
            </p>
          </div>

          <div>
            <span>03</span>

            <p>
              <strong>
                WhatsApp
              </strong>

              <small>
                Abre el chat y decide si deseas enviarlo.
              </small>
            </p>
          </div>
        </div>


        <label className="benefit-message-block">
          <span>
            Mensaje sugerido
          </span>

          <textarea
            className="benefit-message-preview"
            readOnly
            value={message}
            aria-label="Mensaje sugerido para WhatsApp"
          />
        </label>


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
            className="benefit-share-action"
            type="button"
            disabled={busy}
            onClick={() =>
              void downloadImage()
            }
          >
            Descargar PNG
          </button>

          <button
            className="benefit-share-action"
            type="button"
            onClick={() =>
              void copyMessage()
            }
          >
            Copiar mensaje
          </button>

          <button
            className="benefit-share-action benefit-share-action--outline"
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
