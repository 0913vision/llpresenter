import {
  createMediaId,
  createThemeElementId,
  createThemeId,
} from '../schema/ids';
import type {ThemeScreenLayout, ThemeText} from '../schema/themes';

export const SERMON_TITLE_THEME_ID = createThemeId(
  '00000000-0000-4000-8000-000000000106',
);

export const SUNDAY_PICTURE_IDS = {
  scripture: createMediaId('00000000-0000-4000-8000-000000000381'),
} as const;

const id = (number: number) =>
  createThemeElementId(
    `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  );
const text: ThemeText = {
  font: 'NanumSquare',
  weight: 700,
  size: 104,
  color: '#FFFFFF',
  align: 'left',
  vAlign: 'top',
  lineHeight: 150 / 104,
  tracking: -3,
  shadow: {
    on: false,
    color: '#000000',
    opacity: 0,
    angle: 45,
    blur: 0,
    distance: 0,
  },
  outline: {on: false, color: '#000000', width: 1},
};

export function sundayScriptureLayout(): ThemeScreenLayout {
  return {
    mode: {kind: 'own'},
    elements: [
      {
        id: id(1),
        kind: 'image',
        mediaId: SUNDAY_PICTURE_IDS.scripture,
        frame: {x: 0, y: 0, w: 1920, h: 1080},
        fit: 'stretch',
        radius: 0,
      },
      {
        id: id(2),
        kind: 'background',
        frame: {x: 0, y: 0, w: 1920, h: 1080},
        fit: 'fill',
        radius: 0,
      },
      {
        id: id(4),
        kind: 'media',
        frame: {x: 0, y: 0, w: 1920, h: 1080},
        fit: 'fill',
        radius: 0,
      },
      {
        id: id(8),
        kind: 'reference',
        source: 'item',
        frame: {x: 130.6, y: 107, w: 1660, h: 120},
        text: {...text, size: 72, tracking: 0, lineHeight: 1.2},
      },
      {
        id: id(3),
        kind: 'currentText',
        frame: {x: 130.6, y: 248, w: 1660, h: 750},
        text: {...text, maxLines: 4},
      },
    ],
  };
}

export function sermonTitleLayout(): ThemeScreenLayout {
  const stack = {group: 'sermon-title', center: 540, ink: true};
  const elements = [id(8), id(3)];
  const gap = 98.55;
  return {
    mode: {kind: 'own'},
    elements: [
      {
        id: id(1),
        kind: 'image',
        mediaId: SUNDAY_PICTURE_IDS.scripture,
        frame: {x: 0, y: 0, w: 1920, h: 1080},
        fit: 'stretch',
        radius: 0,
      },
      ...(['above', 'below'] as const).map((side, index) => ({
        id: id(10 + index),
        kind: 'box' as const,
        drawHeight: 4,
        frame: {x: 542, y: index === 0 ? 289 : 787, w: 837, h: 8},
        box: {on: true, fill: '#737D87', opacity: 100, radius: 0},
        follow: {elements, side, gap, snap: true},
      })),
      {
        id: id(8),
        kind: 'itemName',
        stack,
        frame: {x: 260, y: 356, w: 1400, h: 150},
        text: {
          ...text,
          font: 'KoPubWorldDotum',
          weight: 500,
          size: 86,
          tracking: 6,
          lineHeight: 1.2,
          align: 'center',
          vAlign: 'middle',
        },
      },
      {
        id: id(3),
        kind: 'currentText',
        fitLines: 2,
        stack,
        frame: {x: 100, y: 509.7, w: 1720, h: 390},
        text: {
          ...text,
          font: 'KoPubWorldDotum',
          size: 140,
          tracking: -6,
          lineHeight: 1.19,
          align: 'center',
          vAlign: 'top',
          maxLines: 2,
        },
      },
    ],
  };
}
