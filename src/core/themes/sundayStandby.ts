import {
  createMediaId,
  createThemeElementId,
  createThemeId,
} from '../schema/ids';
import type {ThemeScreenLayout, ThemeText} from '../schema/themes';

export const PREPARATION_THEME_ID = createThemeId(
  '00000000-0000-4000-8000-000000000110',
);

export const SUNDAY_STANDBY_PICTURE_IDS = {
  serviceTimes: createMediaId('00000000-0000-4000-8000-000000000390'),
  preparation: createMediaId('00000000-0000-4000-8000-000000000391'),
} as const;

const id = (number: number) =>
  createThemeElementId(
    `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  );
const text: ThemeText = {
  font: 'KoPubWorldDotum',
  weight: 500,
  size: 52,
  color: '#FFFFFF',
  align: 'left',
  vAlign: 'top',
  lineHeight: 72.3 / 52,
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

export function sundayServiceTimesLayout(): ThemeScreenLayout {
  return {
    mode: {kind: 'own'},
    elements: [
      {
        id: id(1),
        kind: 'image',
        mediaId: SUNDAY_STANDBY_PICTURE_IDS.serviceTimes,
        frame: {x: 0, y: 0, w: 1920, h: 1080},
        fit: 'stretch',
        radius: 0,
      },
      {
        id: id(2),
        kind: 'text',
        content: 'LOVELIGHT',
        frame: {x: 650, y: 89, w: 620, h: 120},
        text: {
          ...text,
          font: 'Noto Sans CJK KR',
          weight: 900,
          size: 80,
          tracking: 12,
          lineHeight: 1.2,
          align: 'center',
        },
      },
      {
        id: id(3),
        kind: 'text',
        content: 'SUN\nSUN\nSUN\nSUN\nWED\nFRI\nWEEK',
        frame: {x: 556, y: 282, w: 150, h: 520},
        text: {...text, font: 'Noto Sans CJK KR', weight: 100, align: 'right'},
      },
      {
        id: id(4),
        kind: 'text',
        content:
          'AM 08:00\nAM 11:30\nAM 11:30\nPM 01:30\nPM 08:00\nPM 09:00\nAM 09:00',
        frame: {x: 740, y: 282, w: 210, h: 520},
        text: {...text, font: 'Noto Sans CJK KR', weight: 400, tracking: -3.4},
      },
      {
        id: id(5),
        kind: 'text',
        content:
          '주일 1부 예배\n청소년부 예배\n주일 2부 예배\n청년부 예배\n수요 예배\n금요 예배\n아침 기도회',
        frame: {x: 980, y: 281, w: 320, h: 520},
        text,
      },
      {
        id: id(6),
        kind: 'text',
        content:
          '우리 가운데서 역사하시는 능력대로 우리가 구하거나 생각하는 모든 것에 더 넘치도록 능히 하실 이에게 교회 안에서와\n그리스도 예수 안에서 영광이 대대로 영원무궁하기를 원하노라 아멘 (에베소서 3:20-21)',
        frame: {x: 215, y: 881, w: 1490, h: 100},
        text: {
          ...text,
          size: 36,
          tracking: -2.92,
          lineHeight: 44.5 / 36,
          align: 'center',
        },
      },
    ],
  };
}

export function sundayPreparationLayout(): ThemeScreenLayout {
  return {
    mode: {kind: 'own'},
    elements: [
      {
        id: id(1),
        kind: 'image',
        mediaId: SUNDAY_STANDBY_PICTURE_IDS.preparation,
        frame: {x: 0, y: 0, w: 1920, h: 1080},
        fit: 'stretch',
        radius: 0,
      },
      {
        id: id(2),
        kind: 'text',
        content: '잠시후에 예배가 시작됩니다',
        frame: {x: 200, y: 408, w: 1520, h: 200},
        text: {
          ...text,
          weight: 700,
          size: 120,
          lineHeight: 1.2,
          align: 'center',
        },
      },
      {
        id: id(3),
        kind: 'text',
        content: '지금은 기도로 예배를 준비하는 시간입니다',
        frame: {x: 200, y: 573, w: 1520, h: 110},
        text: {
          ...text,
          weight: 700,
          size: 74,
          tracking: -6,
          lineHeight: 1.2,
          align: 'center',
        },
      },
    ],
  };
}
