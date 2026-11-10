import {createThemeElementId} from '../schema/ids';
import type {
  ThemeElement,
  ThemeScreenLayout,
  ThemeText,
} from '../schema/themes';
import {BROADCAST_TEXT_ID, BROADCAST_REFERENCE_ID} from './broadcastBand';

export const BROADCAST_LOOK_BAND_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000481',
);
export const BROADCAST_LOOK_SONG_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000483',
);
export const BROADCAST_LOOK_CARD_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000484',
);
export const BROADCAST_LOOK_TAB_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000485',
);
/** Reference-pixel geometry for the built-in broadcast composition. */
export const BROADCAST_LOOK_GEOMETRY = {
  screenWidth: 1920,
  screenHeight: 1080,
  bandWidth: 1824,
  bodyX: 67,
  bodyWidth: 1690,
  bandMinHeight: 150,
  bandPaddingTop: 22,
  bandPaddingBottom: 26,
  bodyWeight: 700,
  bodySize: 54,
  bodyMinSize: 44,
  bodyLineHeight: 1.25,
  bodyPreferredLines: 3,
  maxBodyHeight: 900,
  tabHeight: 64,
  tabTextSize: 36,
  tabRightPadding: 48,
  tabTextSlack: 2,
  songX: 160,
  songWidth: 1600,
  songSize: 64,
  songLines: 2,
  songBottom: 1004,
  cardMinWidth: 640,
  cardLeft: 56,
  cardRight: 64,
  cardTop: 28,
  cardBottom: 32,
  cardNameSize: 64,
  cardNameHeight: 80,
  cardEnglishSize: 34,
  cardEnglishWeight: 600,
  cardEnglishGap: 8,
  cardEnglishHeight: 42.5,
  cardEnglishFrameHeight: 43,
  minExtent: 8,
  measureTolerance: 1,
} as const;
const geometry = BROADCAST_LOOK_GEOMETRY;
const frame = {x: 0, y: 0, w: geometry.screenWidth, h: geometry.screenHeight};
const style: ThemeText & {maxLines: number} = {
  font: 'Pretendard Variable',
  weight: geometry.bodyWeight,
  size: geometry.bodySize,
  color: '#ffffff',
  align: 'left',
  vAlign: 'top',
  lineHeight: geometry.bodyLineHeight,
  tracking: 0,
  maxLines: 12,
  outline: {on: false, color: '#000000', width: 3},
  shadow: {
    on: false,
    color: '#000000',
    opacity: 100,
    angle: 45,
    blur: 0,
    distance: 3,
  },
};
const outlined = {
  ...style,
  outline: {...style.outline, on: true},
  shadow: {...style.shadow, on: true},
};
const box = (
  id: typeof BROADCAST_LOOK_BAND_ID,
  fill: string,
): ThemeElement => ({
  id,
  kind: 'box',
  frame,
  box: {on: true, fill, opacity: 100, radius: 0},
});
/** Built-in broadcast composition; all decoration is opaque and alpha-safe. */
export function broadcastLookLayout(
  kind: 'plain' | 'song' | 'card',
): ThemeScreenLayout {
  const elements: ThemeElement[] = [];
  if (kind === 'plain') {
    elements.push(
      box(BROADCAST_LOOK_BAND_ID, '#106A84'),
      box(BROADCAST_LOOK_TAB_ID, '#F7F8FC'),
    );
  }
  if (kind === 'card') elements.push(box(BROADCAST_LOOK_CARD_ID, '#1D3A96'));
  if (kind === 'card') {
    elements.push({
      id: BROADCAST_TEXT_ID,
      kind: 'itemName',
      frame,
      text: {...style, size: geometry.cardNameSize},
    });
    elements.push({
      id: BROADCAST_REFERENCE_ID,
      kind: 'currentText',
      frame,
      text: {
        ...style,
        size: geometry.cardEnglishSize,
        weight: geometry.cardEnglishWeight,
      },
    });
  } else {
    elements.push({
      id: kind === 'song' ? BROADCAST_LOOK_SONG_ID : BROADCAST_TEXT_ID,
      kind: 'currentText',
      frame,
      text:
        kind === 'song'
          ? {
              ...outlined,
              size: geometry.songSize,
              align: 'center',
              maxLines: geometry.songLines,
            }
          : style,
    });
    if (kind === 'plain') {
      elements.push({
        id: BROADCAST_REFERENCE_ID,
        kind: 'reference',
        frame,
        text: {...style, size: geometry.tabTextSize, color: '#1A1A1A'},
      });
    }
  }
  return {mode: {kind: 'own'}, elements};
}
