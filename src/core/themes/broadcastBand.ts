import {createThemeElementId} from '../schema/ids';
import type {
  ThemeElement,
  ThemeScreenLayout,
  ThemeText,
} from '../schema/themes';
import type {ThemeItemKind} from './elementRules';

/** Identifies the built-in band without changing the theme file schema. */
export const BROADCAST_BAND_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000090',
);
export const BROADCAST_TEXT_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000091',
);
export const BROADCAST_TITLE_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000092',
);
export const BROADCAST_REFERENCE_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000093',
);
export const BROADCAST_MEDIA_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000094',
);
export const BROADCAST_MIN_TEXT = 48;
export const BROADCAST_GEOMETRY = {
  width: 1920,
  height: 1080,
  bottom: 58,
  minHeight: 204,
  maxHeight: 360,
  padding: 24,
  sidePadding: 144,
  extraHeight: 64,
  textSize: 64,
  detailSize: 52,
  lineHeight: 1.22,
} as const;

/** The colors match the application's bg-panel and text-on-fill tokens. */
export function broadcastBandLayout(
  kind: ThemeItemKind,
  basic: ThemeText,
): ThemeScreenLayout {
  const text = {
    ...basic,
    font: 'Pretendard Variable',
    weight: 700,
    size: BROADCAST_GEOMETRY.textSize,
    color: '#ffffff',
    align: 'center',
    vAlign: 'middle',
    lineHeight: BROADCAST_GEOMETRY.lineHeight,
    tracking: 0,
    maxLines: 12,
    shadow: {...basic.shadow, on: false},
    outline: {...basic.outline, on: false},
  } satisfies ThemeText & {maxLines: number};
  const elements: ThemeElement[] = [
    ...(kind === 'ad'
      ? [
          {
            id: BROADCAST_MEDIA_ID,
            kind: 'media' as const,
            frame: {
              x: 0,
              y: 0,
              w: BROADCAST_GEOMETRY.width,
              h: BROADCAST_GEOMETRY.height,
            },
            fit: 'fill' as const,
            radius: 0,
          },
        ]
      : []),
    {
      id: BROADCAST_BAND_ID,
      kind: 'box',
      frame: {
        x: 0,
        y:
          BROADCAST_GEOMETRY.height -
          BROADCAST_GEOMETRY.bottom -
          BROADCAST_GEOMETRY.minHeight,
        w: BROADCAST_GEOMETRY.width,
        h: BROADCAST_GEOMETRY.minHeight,
      },
      box: {on: true, fill: '#1c1c1c', opacity: 100, radius: 0},
    },
    ...(kind === 'ad'
      ? [
          {
            id: BROADCAST_TITLE_ID,
            kind: 'slideName' as const,
            frame: {
              x: BROADCAST_GEOMETRY.sidePadding,
              y:
                BROADCAST_GEOMETRY.height -
                BROADCAST_GEOMETRY.bottom -
                BROADCAST_GEOMETRY.minHeight +
                BROADCAST_GEOMETRY.padding,
              w: BROADCAST_GEOMETRY.width - BROADCAST_GEOMETRY.sidePadding * 2,
              h: BROADCAST_GEOMETRY.extraHeight,
            },
            text: {...text, size: BROADCAST_GEOMETRY.detailSize},
          },
        ]
      : []),
    {
      id: BROADCAST_TEXT_ID,
      kind: 'currentText',
      frame: {
        x: BROADCAST_GEOMETRY.sidePadding,
        y:
          BROADCAST_GEOMETRY.height -
          BROADCAST_GEOMETRY.bottom -
          BROADCAST_GEOMETRY.minHeight +
          BROADCAST_GEOMETRY.padding,
        w: BROADCAST_GEOMETRY.width - BROADCAST_GEOMETRY.sidePadding * 2,
        h: BROADCAST_GEOMETRY.minHeight - BROADCAST_GEOMETRY.padding * 2,
      },
      text,
    },
    ...(kind === 'bible' || kind === 'blank'
      ? [
          {
            id: BROADCAST_REFERENCE_ID,
            kind: 'reference' as const,
            frame: {
              x: BROADCAST_GEOMETRY.sidePadding,
              y:
                BROADCAST_GEOMETRY.height -
                BROADCAST_GEOMETRY.bottom -
                BROADCAST_GEOMETRY.extraHeight,
              w: BROADCAST_GEOMETRY.width - BROADCAST_GEOMETRY.sidePadding * 2,
              h: BROADCAST_GEOMETRY.extraHeight,
            },
            text: {
              ...text,
              size: BROADCAST_GEOMETRY.detailSize,
              align: 'right' as const,
            },
          },
        ]
      : []),
  ];
  return {mode: {kind: 'own'}, elements};
}
