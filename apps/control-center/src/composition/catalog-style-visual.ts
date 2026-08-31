export type StyleEditorialTemplate = 'A' | 'B' | 'C' | 'D';

export type StyleFacePolicy = {
  mode: 'NOSE_DOWN_MAX';
  appliesToSecondaryFaces: true;
  allowedCorrectionMethods: readonly [
    'CROP',
    'REFRAME',
    'REPOSITION',
    'MODERATE_SCALE',
    'FRAME_LIMIT',
    'EDITORIAL_RESOURCE',
  ];
  forbiddenTransformations: readonly [
    'GENERATE_FACE',
    'REBUILD_FACE',
    'CHANGE_MODEL',
    'INVENT_ANATOMY',
    'TRANSFORM_PRODUCT',
  ];
};

export type StyleVisualFoundation = {
  line: 'STYLE';
  identity: 'LIHEN.CO STYLE';
  templates: readonly StyleEditorialTemplate[];
  preferredRotation: readonly StyleEditorialTemplate[];
  palette: {
    cream: string;
    beige: string;
    nude: string;
    warmWhite: string;
    brown: string;
    gold: string;
    dustyRose: string;
    softLilac: string;
  };
  typography: {
    editorial: string;
    functional: string;
  };
  facePolicy: StyleFacePolicy;
};

export const STYLE_VISUAL_FOUNDATION: StyleVisualFoundation = {
  line: 'STYLE',
  identity: 'LIHEN.CO STYLE',
  templates: ['A', 'B', 'C', 'D'],
  preferredRotation: ['A', 'B', 'C', 'D'],
  palette: {
    cream: '#fbf6ef',
    beige: '#e9ddd1',
    nude: '#d9c4b6',
    warmWhite: '#fffdf9',
    brown: '#49362f',
    gold: '#b88935',
    dustyRose: '#e5c8ca',
    softLilac: '#e6ddef',
  },
  typography: {
    editorial: 'Georgia, "Times New Roman", serif',
    functional:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  facePolicy: {
    mode: 'NOSE_DOWN_MAX',
    appliesToSecondaryFaces: true,
    allowedCorrectionMethods: [
      'CROP',
      'REFRAME',
      'REPOSITION',
      'MODERATE_SCALE',
      'FRAME_LIMIT',
      'EDITORIAL_RESOURCE',
    ],
    forbiddenTransformations: [
      'GENERATE_FACE',
      'REBUILD_FACE',
      'CHANGE_MODEL',
      'INVENT_ANATOMY',
      'TRANSFORM_PRODUCT',
    ],
  },
};

export function getStyleTemplateSeed(index: number): StyleEditorialTemplate {
  const rotation = STYLE_VISUAL_FOUNDATION.preferredRotation;
  return rotation[index % rotation.length] ?? 'A';
}
