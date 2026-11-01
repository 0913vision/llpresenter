import {defaultPreferences} from '@core/schema/preferences';
import type {Screen} from '@core/schema/screens';
import type {SettingsName} from '@core/schema/settingsDocuments';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {createDefaultThemes} from '@core/themes/defaults';
import {DEFAULT_LABELS} from './defaults';

const uuid = (number: number): string =>
  `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const {main: MAIN, broadcast: CAPTIONS, stage: STAGE} = STARTER_SCREEN_IDS;
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
  alwaysOnTop: false,
  preventSleep: true,
  edgeMargin: 0,
  offset: {x: 0, y: 0},
});
/** Spec 02 starter files share IDs for their screen, style and layout references. */
export const settingsDefaults: Readonly<Record<SettingsName, object>> = {
  themes: createDefaultThemes(),
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
        file: 'krv.llbible',
        default: true,
      },
      {
        id: 'kjv',
        name: 'KJV',
        lang: 'English',
        file: 'kjv.llbible',
        default: false,
      },
    ],
    recents: [],
  },
};
