import {defaultPreferences} from '@core/schema/preferences';
import type {Screen} from '@core/schema/screens';
import type {SettingsName} from '@core/schema/settingsDocuments';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {DEFAULT_THEMES} from './themeFiles';
import {DEFAULT_LABELS} from './defaults';

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
  edgeMargin: 0,
  offset: {x: 0, y: 0},
});
/** Spec 02 starter files share IDs for their screen, style and layout references. */
export const settingsDefaults: Readonly<Record<SettingsName, object>> = {
  themes: DEFAULT_THEMES,
  screens: {
    screens: [
      screen(MAIN, '청중 화면', {kind: 'audience', method: 'fullscreen'}),
      {
        ...screen(CAPTIONS, '방송 화면', {
          kind: 'broadcast',
          method: 'ndi',
        }),
        resolution: {width: 1920, height: 1080},
        previewBackground: 'green',
      },
      screen(STAGE, '무대 화면', {kind: 'stage', method: 'fullscreen'}),
    ],
  },
  macros: {macros: [], collections: []},
  quick: {items: []},
  messages: {
    templates: [],
  },
  props: {props: []},
  timers: {timers: []},
  labels: {labels: DEFAULT_LABELS, defaultVerseLabelVersion: 1},
  bibleCuts: {entries: {}},
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
