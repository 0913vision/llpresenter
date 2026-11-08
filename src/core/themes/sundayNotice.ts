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
        frame: {x: 97, y: 21, w: 113, h: 208},
        text: {
          ...text,
          size: 160,
          tracking: -6,
          align: 'center',
          lineHeight: 1,
        },
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
        frame: {x: 240, y: 107, w: 1540, h: 145},
        text: {...text, lineHeight: 1},
      },
      {
        id: id(6),
        kind: 'currentText',
        frame: {x: 129, y: 287, w: 1676, h: 776},
        text: {
          ...text,
          size: 86,
          weight: 500,
          lineHeight: 128 / 86,
          vAlign: 'top',
          bullets: true,
          bulletStyle: 'disc',
          maxLines: 6,
        },
      },
      {id: id(4), kind: 'media', frame, fit: 'fill', radius: 0},
    ],
  };
}
