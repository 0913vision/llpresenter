import {createMediaId, createThemeElementId} from '../schema/ids';
import type {ThemeScreenLayout, ThemeText} from '../schema/themes';

export const SUNDAY_NOTICE_PICTURE_ID = createMediaId(
  '00000000-0000-4000-8000-000000000384',
);
export const SUNDAY_NOTICE_DIVIDER_ID = createMediaId(
  '00000000-0000-4000-8000-000000000385',
);

const id = (number: number) =>
  createThemeElementId(
    `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  );
const frame = {x: 0, y: 0, w: 1920, h: 1080};
const text: ThemeText = {
  font: 'KoPubWorldDotum',
  weight: 700,
  size: 108,
  color: '#FFFFFF',
  align: 'left',
  vAlign: 'middle',
  lineHeight: 1.2,
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

export function sundayNoticeLayout(): ThemeScreenLayout {
  return {
    mode: {kind: 'own'},
    elements: [
      {
        id: id(1),
        kind: 'image',
        mediaId: SUNDAY_NOTICE_PICTURE_ID,
        frame,
        fit: 'stretch',
        radius: 0,
      },
      {id: id(2), kind: 'background', frame, fit: 'fit', radius: 0},
      {
        id: id(7),
        kind: 'slideNumber',
        frame: {x: 55, y: 51, w: 200, h: 260},
        text: {...text, size: 160, tracking: -6, align: 'center'},
      },
      {
        id: id(8),
        kind: 'image',
        mediaId: SUNDAY_NOTICE_DIVIDER_ID,
        frame,
        fit: 'stretch',
        radius: 0,
      },
      {
        id: id(5),
        kind: 'slideName',
        frame: {x: 241.4, y: 150, w: 1540, h: 180},
        text,
      },
      {
        id: id(6),
        kind: 'currentText',
        frame: {x: 169.4, y: 363, w: 1581.2, h: 620},
        text: {
          ...text,
          size: 86,
          weight: 500,
          lineHeight: 104.5 / 86,
          vAlign: 'top',
          bullets: true,
          maxLines: 6,
        },
      },
      {id: id(4), kind: 'media', frame, fit: 'fill', radius: 0},
    ],
  };
}
