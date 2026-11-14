import {createThemeElementId} from '../schema/ids';
import type {ThemeScreenLayout, ThemeText} from '../schema/themes';
import {BROADCAST_LOOK_GEOMETRY as geometry} from './broadcastLook';
import {STARTER_TEXT_STYLE} from './starterLayout';

export const SECTION_BAND_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000486',
);
export const SECTION_NAME_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000487',
);
export const SECTION_ENGLISH_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000488',
);

const bandHeight =
  geometry.songLines * geometry.songSize * geometry.songLineHeight +
  2 * geometry.songBandPadding;
const bandTop = geometry.songBandBottom - bandHeight;
const text: ThemeText = {
  ...STARTER_TEXT_STYLE,
  font: 'Pretendard Variable',
  size: geometry.cardNameSize,
  color: '#FFFFFF',
  align: 'center',
  vAlign: 'top',
  lineHeight: geometry.songLineHeight,
  tracking: 0,
  shadow: {...STARTER_TEXT_STYLE.shadow, on: false},
  outline: {...STARTER_TEXT_STYLE.outline, on: false},
};

/** A fixed two-line song-height band, shared by all broadcast section cards. */
export function sectionBroadcastLayout(): ThemeScreenLayout {
  const nameHeight = geometry.cardNameSize * geometry.songLineHeight;
  const englishHeight = geometry.cardEnglishSize * geometry.songLineHeight;
  const groupTop = bandTop + (bandHeight - nameHeight - englishHeight) / 2;
  return {
    mode: {kind: 'own'},
    elements: [
      {
        id: SECTION_BAND_ID,
        kind: 'box',
        frame: {x: 0, y: bandTop, w: geometry.screenWidth, h: bandHeight},
        box: {
          on: true,
          fill: '#000000',
          opacity: geometry.songBandOpacity,
          radius: 0,
        },
      },
      {
        id: SECTION_NAME_ID,
        kind: 'itemName',
        frame: {
          x: geometry.songX,
          y: groupTop,
          w: geometry.songWidth,
          h: nameHeight + englishHeight,
        },
        centerWhenTextEmpty: true,
        text,
      },
      {
        id: SECTION_ENGLISH_ID,
        kind: 'currentText',
        frame: {
          x: geometry.songX,
          y: groupTop + nameHeight,
          w: geometry.songWidth,
          h: englishHeight,
        },
        text: {
          ...text,
          size: geometry.cardEnglishSize,
          weight: geometry.cardEnglishWeight,
          maxLines: 1,
        },
      },
    ],
  };
}
