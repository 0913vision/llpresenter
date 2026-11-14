import {createThemeElementId} from '../schema/ids';
import type {ThemeScreenLayout, ThemeText} from '../schema/themes';

export const SECTION_BAND_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000486',
);
export const SECTION_NAME_ID = createThemeElementId(
  '00000000-0000-4000-8000-000000000487',
);

const text: ThemeText = {
  font: 'Pretendard Variable',
  weight: 700,
  size: 64,
  color: '#FFFFFF',
  align: 'center',
  vAlign: 'top',
  lineHeight: 1.25,
  tracking: 0,
  shadow: {
    on: true,
    color: '#000000',
    opacity: 80,
    angle: 90,
    blur: 6,
    distance: 2,
  },
  outline: {on: false, color: '#000000', width: 3},
};

/** The one-line fading band shared by broadcast section cards. */
export function sectionBroadcastLayout(): ThemeScreenLayout {
  return {
    mode: {kind: 'own'},
    elements: [
      {
        id: SECTION_BAND_ID,
        kind: 'box',
        frame: {x: 0, y: 888, w: 1920, h: 102},
        box: {on: true, fill: '#000000', opacity: 88, radius: 0},
      },
      {
        id: SECTION_NAME_ID,
        kind: 'itemName',
        frame: {x: 230, y: 900, w: 1460, h: 90},
        text,
      },
    ],
  };
}
