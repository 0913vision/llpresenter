import {defaultPreferences} from '@shared/schema/preferences';
import type {Screen} from '@shared/schema/screens';
import type {SettingsName} from '@shared/schema/settingsDocuments';
import {STARTER_SCREEN_IDS} from '@shared/screens';
import {DEFAULT_LABELS} from './defaults';

const uuid = (number: number): string =>
  `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const {main: MAIN, broadcast: CAPTIONS, stage: STAGE} = STARTER_SCREEN_IDS;
const LOOK = uuid(4);
const LAYOUT = uuid(5);
const style = {
  font: 'Pretendard',
  weight: 700,
  size: 84,
  color: '#FFFFFF',
  lineHeight: 1.4,
  align: 'center',
  vAlign: 'middle',
  maxLines: 2,
  margin: 6,
  shadow: true,
  outline: false,
};
const screen = (
  id: string,
  name: string,
  {kind, method}: Pick<Screen, 'kind' | 'method'>,
) => ({
  id,
  name,
  kind,
  method,
  onDisconnect: 'window',
  alwaysOnTop: method === 'fullscreen',
  preventSleep: true,
  edgeMargin: 0,
  offset: {x: 0, y: 0},
});
const element = (
  kind: string,
  name: string,
  [x, y, w, h]: readonly [number, number, number, number],
) => ({id: kind, name, kind, frame: {x, y, w, h}});

/** Spec 02 starter files share IDs for their screen, style and layout references. */
export const settingsDefaults: Readonly<Record<SettingsName, object>> = {
  screens: {
    screens: [
      screen(MAIN, '본 화면', {kind: 'audience', method: 'fullscreen'}),
      {
        ...screen(CAPTIONS, '방송 자막', {kind: 'audience', method: 'capture'}),
        resolution: {width: 1920, height: 1080},
        previewBackground: 'green',
      },
      screen(STAGE, '무대 화면', {kind: 'stage', method: 'fullscreen'}),
    ],
  },
  looks: {
    current: LOOK,
    looks: [
      {
        id: LOOK,
        name: '평상시',
        screens: {
          [MAIN]: {
            layers: {
              media: true,
              slide: true,
              prop: true,
              message: true,
              notice: false,
            },
            lyricStyle: uuid(6),
          },
          [CAPTIONS]: {
            layers: {
              media: true,
              slide: true,
              prop: false,
              message: false,
              notice: false,
            },
            lyricStyle: uuid(8),
            background: {kind: 'color', color: '#00B140'},
          },
          [STAGE]: {
            layers: {
              slide: true,
              clock: true,
              stageMessage: true,
              media: false,
              message: false,
            },
            stageLayout: LAYOUT,
            lyricStyle: uuid(7),
          },
        },
      },
    ],
    lyricStyles: [
      {...style, id: uuid(6), name: '기본'},
      {
        ...style,
        id: uuid(7),
        name: '현재와 다음',
        size: 72,
        align: 'left',
        vAlign: 'top',
        lineHeight: 1.3,
        margin: 0,
      },
      {...style, id: uuid(8), name: '하단 자막', vAlign: 'bottom'},
    ],
  },
  'stage-layouts': {
    layouts: [
      {
        id: LAYOUT,
        name: '현재와 다음',
        width: 1920,
        height: 1080,
        elements: [
          element('currentLabel', '현재 이름표', [45, 49, 330, 39]),
          element('currentSlide', '현재 가사', [45, 100, 1194, 260]),
          element('clock', '시계', [1440, 60, 420, 120]),
          element('timer', '타이머', [1440, 189, 420, 60]),
          element('nextLabel', '다음 이름표', [45, 471, 1194, 38]),
          element('nextSlide', '다음 가사', [45, 520, 1194, 170]),
          element('stageMessage', '무대 메시지', [0, 960, 1920, 120]),
        ],
      },
    ],
  },
  macros: {macros: [], collections: []},
  quick: {items: [{id: uuid(9), name: '검은 화면', kind: 'black'}]},
  messages: {
    templates: [],
    stagePresets: [
      '후렴 한 번 더',
      '마지막 후렴',
      '처음부터',
      '천천히',
      '조금 빠르게',
      '5분 남음',
      '마무리',
    ],
  },
  notices: {sets: []},
  props: {props: []},
  timers: {timers: []},
  labels: {labels: DEFAULT_LABELS},
  preferences: defaultPreferences,
  shortcuts: {bindings: {}},
  bible: {
    translations: [
      {
        id: 'krv',
        name: '개역한글',
        lang: '한국어',
        file: 'krv.json',
        default: true,
      },
      {
        id: 'kjv',
        name: 'KJV',
        lang: 'English',
        file: 'kjv.json',
        default: false,
      },
    ],
    recents: [],
  },
};
