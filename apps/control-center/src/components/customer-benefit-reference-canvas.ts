import logo from '../assets/brand/lihen-logo-official.png';

import {
  buildCustomerBenefitVisualModel,
  type CustomerBenefitCreativeInput,
} from '../domain/customer-benefit-creative';


type Palette = {
  readonly backgroundStart: string;
  readonly backgroundMiddle: string;
  readonly backgroundEnd: string;
  readonly accent: string;
  readonly accentStrong: string;
  readonly accentSoft: string;
  readonly gold: string;
  readonly text: string;
  readonly muted: string;
  readonly panel: string;
  readonly panelStrong: string;
  readonly border: string;
};


const BEAUTY_PALETTE: Palette = {
  backgroundStart: '#fff8f5',
  backgroundMiddle: '#f8dce9',
  backgroundEnd: '#faeee5',
  accent: '#c76988',
  accentStrong: '#cf4777',
  accentSoft: '#f2cbd8',
  gold: '#b88847',
  text: '#342625',
  muted: '#725f62',
  panel: 'rgba(255, 248, 246, 0.78)',
  panelStrong: 'rgba(255, 250, 248, 0.91)',
  border: '#d7aa91',
};


const STYLE_PALETTE: Palette = {
  backgroundStart: '#fbf7ff',
  backgroundMiddle: '#e3d5f3',
  backgroundEnd: '#f7e8e5',
  accent: '#9b789b',
  accentStrong: '#89669a',
  accentSoft: '#dfcfee',
  gold: '#ad854d',
  text: '#342735',
  muted: '#716272',
  panel: 'rgba(252, 248, 255, 0.78)',
  panelStrong: 'rgba(255, 251, 255, 0.91)',
  border: '#cdb3d0',
};


function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r =
    Math.min(
      radius,
      width / 2,
      height / 2,
    );

  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
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
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - r,
  );
  context.lineTo(x, y + r);
  context.quadraticCurveTo(
    x,
    y,
    x + r,
    y,
  );
  context.closePath();
}


function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
): void {
  context.save();

  roundedRect(
    context,
    x,
    y,
    width,
    height,
    radius,
  );

  context.fillStyle =
    fill;

  context.fill();

  if (stroke) {
    context.strokeStyle =
      stroke;

    context.lineWidth =
      2;

    context.stroke();
  }

  context.restore();
}


function centerText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
): void {
  context.textAlign =
    'center';

  context.textBaseline =
    'middle';

  context.fillText(
    text,
    x,
    y,
  );
}


function fitFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  family: string,
  weight = '700',
): number {
  let size =
    startSize;

  while (
    size > minSize
  ) {
    context.font =
      `${weight} ${size}px ${family}`;

    if (
      context.measureText(text).width
      <= maxWidth
    ) {
      return size;
    }

    size -= 2;
  }

  return minSize;
}


function drawSpark(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  context.save();

  context.strokeStyle =
    color;

  context.lineWidth =
    3;

  context.beginPath();

  context.moveTo(
    x,
    y - size,
  );

  context.lineTo(
    x,
    y + size,
  );

  context.moveTo(
    x - size,
    y,
  );

  context.lineTo(
    x + size,
    y,
  );

  context.stroke();

  context.restore();
}


function drawHeart(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string,
): void {
  context.save();

  context.translate(
    x,
    y,
  );

  context.scale(
    scale,
    scale,
  );

  context.beginPath();
  context.moveTo(0, 11);

  context.bezierCurveTo(
    -35,
    -10,
    -34,
    -42,
    -9,
    -42,
  );

  context.bezierCurveTo(
    7,
    -42,
    15,
    -31,
    18,
    -23,
  );

  context.bezierCurveTo(
    21,
    -31,
    29,
    -42,
    45,
    -42,
  );

  context.bezierCurveTo(
    70,
    -42,
    71,
    -10,
    36,
    11,
  );

  context.lineTo(
    18,
    25,
  );

  context.closePath();

  context.strokeStyle =
    color;

  context.lineWidth =
    3;

  context.stroke();

  context.restore();
}


function drawBeautyCorners(
  context: CanvasRenderingContext2D,
  palette: Palette,
): void {
  context.save();

  context.globalAlpha =
    0.58;

  const topGradient =
    context.createLinearGradient(
      0,
      0,
      310,
      240,
    );

  topGradient.addColorStop(
    0,
    '#e8a5b9',
  );

  topGradient.addColorStop(
    1,
    '#f5d7df',
  );

  context.fillStyle =
    topGradient;

  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(320, 0);

  context.bezierCurveTo(
    250,
    95,
    185,
    110,
    122,
    174,
  );

  context.bezierCurveTo(
    75,
    220,
    38,
    280,
    0,
    335,
  );

  context.closePath();
  context.fill();


  const bottomGradient =
    context.createLinearGradient(
      820,
      1080,
      1080,
      1350,
    );

  bottomGradient.addColorStop(
    0,
    '#f1c1d0',
  );

  bottomGradient.addColorStop(
    1,
    '#dda0b5',
  );

  context.fillStyle =
    bottomGradient;

  context.beginPath();

  context.moveTo(
    1080,
    985,
  );

  context.bezierCurveTo(
    990,
    1060,
    955,
    1135,
    930,
    1205,
  );

  context.bezierCurveTo(
    905,
    1270,
    875,
    1320,
    830,
    1350,
  );

  context.lineTo(
    1080,
    1350,
  );

  context.closePath();
  context.fill();


  context.globalAlpha =
    0.82;

  context.strokeStyle =
    palette.gold;

  context.lineWidth =
    3;

  context.beginPath();

  context.moveTo(
    0,
    145,
  );

  context.bezierCurveTo(
    95,
    45,
    175,
    60,
    252,
    0,
  );

  context.stroke();

  context.beginPath();

  context.moveTo(
    1080,
    1160,
  );

  context.bezierCurveTo(
    990,
    1230,
    985,
    1300,
    905,
    1350,
  );

  context.stroke();

  context.restore();
}


function drawStyleCorners(
  context: CanvasRenderingContext2D,
  palette: Palette,
): void {
  context.save();

  context.strokeStyle =
    palette.border;

  context.globalAlpha =
    0.65;

  context.lineWidth =
    2;

  const offsets =
    [0, 22, 44];

  for (
    const offset
    of offsets
  ) {
    context.beginPath();

    context.moveTo(
      62 + offset,
      142 + offset,
    );

    context.lineTo(
      62 + offset,
      58 + offset,
    );

    context.quadraticCurveTo(
      62 + offset,
      38 + offset,
      82 + offset,
      38 + offset,
    );

    context.lineTo(
      345 + offset,
      38 + offset,
    );

    context.stroke();
  }


  context.beginPath();

  context.moveTo(
    835,
    92,
  );

  context.lineTo(
    1010,
    267,
  );

  context.lineTo(
    835,
    442,
  );

  context.stroke();


  context.beginPath();

  context.moveTo(
    245,
    1280,
  );

  context.lineTo(
    820,
    1280,
  );

  context.stroke();

  context.restore();
}


function drawCalendarIcon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: Palette,
): void {
  context.save();

  context.strokeStyle =
    palette.accentStrong;

  context.lineWidth =
    4;

  roundedRect(
    context,
    x,
    y,
    80,
    68,
    10,
  );

  context.stroke();

  context.beginPath();

  context.moveTo(
    x,
    y + 19,
  );

  context.lineTo(
    x + 80,
    y + 19,
  );

  context.stroke();

  context.beginPath();

  context.moveTo(
    x + 18,
    y - 8,
  );

  context.lineTo(
    x + 18,
    y + 10,
  );

  context.moveTo(
    x + 60,
    y - 8,
  );

  context.lineTo(
    x + 60,
    y + 10,
  );

  context.stroke();

  drawHeart(
    context,
    x + 29,
    y + 49,
    0.28,
    palette.accentStrong,
  );

  context.restore();
}


function drawGiftIcon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: Palette,
): void {
  context.save();

  context.strokeStyle =
    palette.gold;

  context.lineWidth =
    4;

  context.strokeRect(
    x,
    y + 24,
    90,
    74,
  );

  context.beginPath();

  context.moveTo(
    x + 45,
    y + 24,
  );

  context.lineTo(
    x + 45,
    y + 98,
  );

  context.moveTo(
    x - 7,
    y + 24,
  );

  context.lineTo(
    x + 97,
    y + 24,
  );

  context.stroke();


  context.beginPath();

  context.moveTo(
    x + 44,
    y + 24,
  );

  context.bezierCurveTo(
    x + 20,
    y + 8,
    x + 16,
    y - 5,
    x + 30,
    y - 8,
  );

  context.bezierCurveTo(
    x + 45,
    y - 10,
    x + 47,
    y + 11,
    x + 44,
    y + 24,
  );

  context.bezierCurveTo(
    x + 70,
    y + 5,
    x + 78,
    y - 8,
    x + 61,
    y - 11,
  );

  context.bezierCurveTo(
    x + 46,
    y - 12,
    x + 43,
    y + 10,
    x + 44,
    y + 24,
  );

  context.stroke();

  drawHeart(
    context,
    x + 54,
    y + 76,
    0.22,
    palette.accentStrong,
  );

  context.restore();
}


function loadLogo(): Promise<HTMLImageElement> {
  return new Promise(
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
            'Unable to load LIHEN official logo.',
          ),
        );

      image.src =
        logo;
    },
  );
}


function canvasToBlob(
  canvas: HTMLCanvasElement,
): Promise<Blob> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error(
                'Unable to generate Customer Benefit PNG.',
              ),
            );

            return;
          }

          resolve(blob);
        },
        'image/png',
        1,
      );
    },
  );
}


export async function createBenefitPng(
  benefit:
    CustomerBenefitCreativeInput,
): Promise<Blob> {
  const model =
    buildCustomerBenefitVisualModel(
      benefit,
    );

  const isStyle =
    model.lineLabel
      .trim()
      .toLowerCase()
      === 'style';

  const palette =
    isStyle
      ? STYLE_PALETTE
      : BEAUTY_PALETTE;

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
      'Canvas context unavailable.',
    );
  }


  /* ==============================================
     BACKGROUND
     ============================================== */

  const background =
    context.createLinearGradient(
      0,
      0,
      1080,
      1350,
    );

  background.addColorStop(
    0,
    palette.backgroundStart,
  );

  background.addColorStop(
    0.48,
    palette.backgroundMiddle,
  );

  background.addColorStop(
    1,
    palette.backgroundEnd,
  );

  context.fillStyle =
    background;

  context.fillRect(
    0,
    0,
    1080,
    1350,
  );


  if (isStyle) {
    drawStyleCorners(
      context,
      palette,
    );
  } else {
    drawBeautyCorners(
      context,
      palette,
    );
  }


  /* Main refined frame */
  context.save();

  context.strokeStyle =
    palette.border;

  context.globalAlpha =
    0.62;

  context.lineWidth =
    2;

  roundedRect(
    context,
    48,
    48,
    984,
    1254,
    44,
  );

  context.stroke();

  context.restore();


  /* ==============================================
     OFFICIAL LIHEN BRAND HEADER
     ============================================== */

  const brandLogo =
    await loadLogo();

  const logoWidth =
    285;

  const logoHeight =
    logoWidth
    * (
      brandLogo.naturalHeight
      / brandLogo.naturalWidth
    );

  context.save();

  /*
   * Approved presentation-time background neutralization.
   * The official source asset is not modified.
   */
  context.globalCompositeOperation =
    'multiply';

  context.drawImage(
    brandLogo,
    (
      1080
      - logoWidth
    ) / 2,
    62,
    logoWidth,
    logoHeight,
  );

  context.restore();


  /* ==============================================
     EMOTIONAL INTRO
     ============================================== */

  context.fillStyle =
    palette.accentStrong;

  context.font =
    'italic 53px "Segoe Script", "Brush Script MT", cursive';

  centerText(
    context,
    model.emotionalHeadline,
    540,
    310,
  );


  context.fillStyle =
    palette.text;

  context.font =
    '600 30px Georgia, "Times New Roman", serif';

  centerText(
    context,
    model.typeLabel,
    540,
    370,
  );


  context.fillStyle =
    palette.muted;

  context.font =
    '400 23px Arial, sans-serif';

  centerText(
    context,
    model.emotionalCopy,
    540,
    414,
  );


  /* ==============================================
     DISCOUNT TICKET
     ============================================== */

  const ticketX =
    103;

  const ticketY =
    455;

  const ticketWidth =
    874;

  const ticketHeight =
    190;

  fillRoundedRect(
    context,
    ticketX,
    ticketY,
    ticketWidth,
    ticketHeight,
    30,
    palette.panel,
    palette.accent,
  );


  /* dashed inner ticket */
  context.save();

  context.setLineDash(
    [12, 10],
  );

  context.strokeStyle =
    palette.accent;

  context.globalAlpha =
    0.48;

  context.lineWidth =
    2;

  roundedRect(
    context,
    ticketX + 20,
    ticketY + 18,
    ticketWidth - 40,
    ticketHeight - 36,
    23,
  );

  context.stroke();

  context.restore();


  /* ticket side notches */
  context.fillStyle =
    palette.backgroundMiddle;

  context.beginPath();

  context.arc(
    ticketX,
    ticketY + ticketHeight / 2,
    26,
    0,
    Math.PI * 2,
  );

  context.fill();

  context.beginPath();

  context.arc(
    ticketX + ticketWidth,
    ticketY + ticketHeight / 2,
    26,
    0,
    Math.PI * 2,
  );

  context.fill();


  /* ticket icon */
  fillRoundedRect(
    context,
    155,
    500,
    126,
    100,
    22,
    palette.accentStrong,
  );

  context.fillStyle =
    '#fffafc';

  context.font =
    '700 53px Georgia, serif';

  centerText(
    context,
    '%',
    218,
    550,
  );


  /* discount */
  context.fillStyle =
    palette.accentStrong;

  context.font =
    '700 92px Georgia, "Times New Roman", serif';

  centerText(
    context,
    model.discountLabel,
    455,
    535,
  );


  context.fillStyle =
    palette.text;

  context.textAlign =
    'left';

  context.font =
    '700 35px Arial, sans-serif';

  context.fillText(
    'DE DESCUENTO',
    595,
    530,
  );


  context.fillStyle =
    palette.muted;

  context.font =
    '400 23px Arial, sans-serif';

  context.fillText(
    'en tu próxima compra',
    595,
    572,
  );


  /* ==============================================
     EXCLUSIVE CODE PANEL
     ============================================== */

  const codeX =
    103;

  const codeY =
    675;

  const codeWidth =
    874;

  const codeHeight =
    190;

  fillRoundedRect(
    context,
    codeX,
    codeY,
    codeWidth,
    codeHeight,
    24,
    palette.panelStrong,
    palette.gold,
  );


  context.fillStyle =
    palette.gold;

  context.font =
    '700 21px Arial, sans-serif';

  centerText(
    context,
    '♥   TU CÓDIGO EXCLUSIVO   ♥',
    455,
    720,
  );


  const codeFontSize =
    fitFontSize(
      context,
      model.codeLabel,
      600,
      62,
      36,
      'Arial, sans-serif',
      '800',
    );

  context.font =
    `800 ${codeFontSize}px Arial, sans-serif`;

  context.fillStyle =
    palette.accentStrong;

  centerText(
    context,
    model.codeLabel,
    455,
    786,
  );


  context.save();

  context.strokeStyle =
    palette.gold;

  context.globalAlpha =
    0.55;

  context.lineWidth =
    2;

  context.beginPath();

  context.moveTo(
    792,
    codeY + 22,
  );

  context.lineTo(
    792,
    codeY + codeHeight - 22,
  );

  context.stroke();

  context.restore();


  drawGiftIcon(
    context,
    835,
    720,
    palette,
  );


  /* ==============================================
     VALIDITY + BENEFIT STATUS
     ============================================== */

  const metaX =
    103;

  const metaY =
    895;

  const metaWidth =
    874;

  const metaHeight =
    150;

  fillRoundedRect(
    context,
    metaX,
    metaY,
    metaWidth,
    metaHeight,
    22,
    'rgba(255,255,255,0.46)',
    palette.border,
  );


  context.save();

  context.strokeStyle =
    palette.border;

  context.globalAlpha =
    0.55;

  context.beginPath();

  context.moveTo(
    540,
    metaY + 20,
  );

  context.lineTo(
    540,
    metaY + metaHeight - 20,
  );

  context.stroke();

  context.restore();


  drawCalendarIcon(
    context,
    145,
    934,
    palette,
  );


  context.textAlign =
    'left';

  context.fillStyle =
    palette.text;

  context.font =
    '700 21px Arial, sans-serif';

  context.fillText(
    'VÁLIDO HASTA',
    250,
    935,
  );


  const validityFont =
    fitFontSize(
      context,
      model.validityValue,
      255,
      29,
      21,
      'Arial, sans-serif',
      '800',
    );

  context.font =
    `800 ${validityFont}px Arial, sans-serif`;

  context.fillStyle =
    palette.accentStrong;

  context.fillText(
    model.validityValue,
    250,
    978,
  );


  /* Right status side */
  context.beginPath();

  context.arc(
    635,
    970,
    44,
    0,
    Math.PI * 2,
  );

  context.fillStyle =
    palette.accentSoft;

  context.fill();


  drawHeart(
    context,
    617,
    981,
    0.45,
    palette.accentStrong,
  );


  context.fillStyle =
    palette.text;

  context.font =
    '700 21px Arial, sans-serif';

  context.fillText(
    'BENEFICIO',
    710,
    950,
  );


  context.fillStyle =
    palette.accentStrong;

  context.font =
    '800 28px Arial, sans-serif';

  context.fillText(
    model.statusLabel.toUpperCase(),
    710,
    989,
  );


  /* ==============================================
     EMOTIONAL CLOSING
     ============================================== */

  fillRoundedRect(
    context,
    103,
    1075,
    874,
    145,
    22,
    (
      isStyle
        ? 'rgba(238,226,247,0.63)'
        : 'rgba(250,222,229,0.63)'
    ),
  );


  drawHeart(
    context,
    155,
    1157,
    0.63,
    palette.accentStrong,
  );


  context.textAlign =
    'left';

  context.fillStyle =
    palette.text;

  context.font =
    '500 24px Arial, sans-serif';

  context.fillText(
    model.closingCopy,
    270,
    1122,
  );


  context.fillStyle =
    palette.accentStrong;

  context.font =
    'italic 41px "Segoe Script", "Brush Script MT", cursive';

  context.fillText(
    '¡Te esperamos!',
    385,
    1178,
  );


  /* ==============================================
     FOOTER
     ============================================== */

  context.textAlign =
    'center';

  context.fillStyle =
    palette.gold;

  context.font =
    '700 26px Georgia, serif';

  centerText(
    context,
    'LIHEN.CO',
    540,
    1250,
  );


  context.fillStyle =
    palette.text;

  context.font =
    '600 15px Arial, sans-serif';

  centerText(
    context,
    'B E A U T Y   C A R E   •   S T Y L E',
    540,
    1281,
  );


  context.fillStyle =
    palette.accentStrong;

  context.fillRect(
    360,
    1304,
    150,
    2,
  );

  context.fillRect(
    570,
    1304,
    150,
    2,
  );


  drawHeart(
    context,
    531,
    1311,
    0.19,
    palette.accentStrong,
  );


  drawSpark(
    context,
    77,
    734,
    15,
    palette.gold,
  );

  drawSpark(
    context,
    990,
    422,
    14,
    palette.gold,
  );


  return canvasToBlob(
    canvas,
  );
}
