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
/** Sizes, colors and effects for the built-in broadcast glass box at 1920×1080. */
export const BROADCAST_LOOK_GEOMETRY = {
  screenWidth: 1920,
  screenHeight: 1080,
  panelX: 58,
  panelWidth: 1804,
  panelBottom: 1026,
  radius: 18,
  frameWidth: 6,
  frameColor: '#E8E8E8',
  frameOpacity: 45,
  panelColor: '#FEFDF9',
  panelOpacity: 90,
  shadowColor: '#000000',
  shadowOpacity: 35,
  shadowBlur: 16,
  headerColor: '#4D4038',
  headerOpacity: 95,
  headerFade: 60,
  headerHeight: 48,
  bodyX: 90,
  bodyWidth: 1740,
  bodyPaddingTop: 22,
  bodyPaddingBottom: 26,
  bodyWeight: 700,
  bodySize: 48,
  bodyMinSize: 42,
  bodyLineHeight: 1.35,
  bodyPreferredLines: 3,
  maxBodyHeight: 900,
  tabTextSize: 30,
  textColor: '#1F1F1F',
  headerTextColor: '#FFFFFF',
  songPanelX: 120,
  songPanelWidth: 1680,
  songX: 160,
  songWidth: 1600,
  songSize: 56,
  songLines: 2,
  songLineHeight: 1.25,
  cardPadding: 28,
  cardNameSize: 52,
  cardNameHeight: 65,
  cardEnglishSize: 28,
  cardEnglishWeight: 600,
  cardEnglishColor: '#6B6B6B',
  cardEnglishGap: 0,
  cardEnglishHeight: 35,
  measureTolerance: 1,
} as const;
const geometry = BROADCAST_LOOK_GEOMETRY;
const frame = {x: 0, y: 0, w: geometry.screenWidth, h: geometry.screenHeight};
const style: ThemeText & {maxLines: number} = {
  font: 'Pretendard Variable',
  weight: geometry.bodyWeight,
  size: geometry.bodySize,
  color: geometry.textColor,
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
const box = (id: typeof BROADCAST_LOOK_BAND_ID): ThemeElement => ({
  id,
  kind: 'box',
  frame,
  box: {
    on: true,
    fill: geometry.panelColor,
    opacity: geometry.panelOpacity,
    radius: geometry.radius,
  },
});
/** Built-in broadcast composition, fitted by the output renderer. */
export function broadcastLookLayout(
  kind: 'plain' | 'song' | 'card',
): ThemeScreenLayout {
  const elements: ThemeElement[] = [];
  if (kind === 'plain') {
    elements.push(box(BROADCAST_LOOK_BAND_ID), box(BROADCAST_LOOK_TAB_ID));
  }
  if (kind === 'card') elements.push(box(BROADCAST_LOOK_CARD_ID));
  if (kind === 'song') elements.push(box(BROADCAST_LOOK_BAND_ID));
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
        color: geometry.cardEnglishColor,
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
              ...style,
              size: geometry.songSize,
              align: 'left',
              lineHeight: geometry.songLineHeight,
              maxLines: geometry.songLines,
            }
          : style,
    });
    if (kind === 'plain') {
      elements.push({
        id: BROADCAST_REFERENCE_ID,
        kind: 'reference',
        frame,
        text: {
          ...style,
          size: geometry.tabTextSize,
          color: geometry.headerTextColor,
        },
      });
    }
  }
  return {mode: {kind: 'own'}, elements};
}
