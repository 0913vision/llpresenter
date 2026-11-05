import type {DocumentApi, LlpApi} from '@contracts/ipc/api';
import type {EditResult} from '@core/schema/contentEdit';
import {emptyLiveState} from '@core/live/state';
import {UI_ZOOM, UI_ZOOM_FACTOR} from '@core/schema/uiZoom';
import {defaultPreferences} from '@core/schema/preferences';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/settingsDocuments';

const EMPTY_SHOW_SETTINGS = new Map<SettingsName, SettingsDocument>();
for (const [name, value] of [
  ['quick', {format: 'llsettings.quick', schemaVersion: 1, items: []}],
  ['screens', {format: 'llsettings.screens', schemaVersion: 1, screens: []}],
  ['timers', {format: 'llsettings.timers', schemaVersion: 1, timers: []}],
  [
    'messages',
    {
      format: 'llsettings.messages',
      schemaVersion: 1,
      templates: [],
    },
  ],
] as const) {
  const parsed = parseSettingsDocument({
    name,
    value,
    revision: 1,
    access: 'editable',
  });
  if (!parsed.ok) throw new Error('Invalid empty show settings fixture');
  EMPTY_SHOW_SETTINGS.set(name, parsed.value);
}

/** The members a test replaces, part by part. */
export type MockLlpApiParts = {
  readonly [Part in keyof LlpApi]?: Partial<LlpApi[Part]>;
};

/**
 * A complete `window.llp` for tests, where every member does nothing. Pass only
 * the members a test needs; the rest of each part keeps its default, so new
 * channels never break existing tests.
 */
export function mockLlpApi(overrides: MockLlpApiParts = {}): LlpApi {
  return {
    bible: {
      lookup: request =>
        Promise.resolve({
          ...request,
          suggestions: [],
          result: {
            ok: false,
            error: {code: 'translation', message: '사용할 수 없는 역본입니다'},
          },
        }),
      ...overrides.bible,
    },
    app: {
      savePending: () => Promise.resolve(true),
      flushProgress: () => undefined,
      subscribeFlushRequests: () => () => undefined,
      flushDone: () => undefined,
      closeAnyway: () => undefined,
      ...overrides.app,
    },
    problems: {
      list: () => Promise.resolve([]),
      subscribe: () => () => undefined,
      retrySaves: () => undefined,
      ...overrides.problems,
    },
    live: {
      get: () => Promise.resolve(emptyLiveState()),
      send: () => undefined,
      subscribe: () => () => undefined,
      clock: () => Promise.resolve(performance.timeOrigin + performance.now()),
      mediaProgress: () => Promise.resolve(null),
      subscribeMediaProgress: () => () => undefined,
      ...overrides.live,
    },
    window: {
      control: () => undefined,
      fullScreen: () => Promise.resolve(false),
      onFullScreen: () => () => undefined,
      editText: () => undefined,
      openScreens: () => undefined,
      openPreferences: () => undefined,
      openPreferencesAt: () => undefined,
      preferencesPage: () => Promise.resolve(null),
      onPreferencesPage: () => () => undefined,
      openLogFolder: () => undefined,
      diagnostics: () => Promise.resolve('diagnostics'),
      setVerboseLogging: () => undefined,
      verboseLogging: () => Promise.resolve(false),
      appInfo: () => Promise.resolve({name: 'LoveLight', version: '0.0.0'}),
      openOrderEditor: () =>
        Promise.resolve({ok: false, error: {reason: 'not-implemented'}}),
      openSongEditor: () =>
        Promise.resolve({ok: false, error: {reason: 'not-implemented'}}),
      ...overrides.window,
    },
    ui: {
      get: () => Promise.resolve({}),
      setLayout: () => undefined,
      setMediaStrip: () => undefined,
      setPrepMedia: () => undefined,
      setMediaBrowser: () => undefined,
      getZoom: () => Promise.resolve(UI_ZOOM.defaultPercent),
      getZoomFactor: () => UI_ZOOM_FACTOR.default,
      changeZoom: () => Promise.resolve(UI_ZOOM.defaultPercent),
      onZoomChanged: () => () => undefined,
      ...overrides.ui,
    },
    log: {write: () => undefined, ...overrides.log},
    monitors: {
      get: () => Promise.resolve([]),
      subscribe: () => () => undefined,
      ...overrides.monitors,
    },
    fonts: {
      get: () => Promise.resolve([]),
      ...overrides.fonts,
    },
    output: {
      reportReady: () => Promise.resolve(false),
      reportFrameRate: () => undefined,
      getStatus: () => Promise.resolve({}),
      subscribeStatus: () => () => undefined,
      retry: () => undefined,
      findMonitors: () => undefined,
      showWindow: () => undefined,
      ...overrides.output,
    },
    service: {
      slidesProjection: () => undefined,
      get: () => Promise.resolve(null),
      open: () => Promise.resolve(null),
      subscribe: () => () => undefined,
      ...overrides.service,
    },
    content: {edit: () => Promise.resolve(NOT_FOUND), ...overrides.content},
    songs: {...emptyDocuments(), ...overrides.songs},
    services: {...emptyDocuments(), ...overrides.services},
    templates: {...emptyDocuments(), ...overrides.templates},
    preferences: {
      get: () => Promise.resolve(defaultPreferences),
      subscribe: () => () => undefined,
      ...overrides.preferences,
    },
    settings: {
      get: request => {
        const document = EMPTY_SHOW_SETTINGS.get(request.name);
        return document === undefined
          ? Promise.reject(new Error('mockLlpApi has no settings documents'))
          : Promise.resolve(document);
      },
      edit: () => Promise.resolve(NOT_FOUND),
      subscribe: () => () => undefined,
      ...overrides.settings,
    },
    media: {
      pathForFile: () => '',
      get: () => Promise.resolve(EMPTY_MEDIA),
      edit: () => Promise.resolve(NOT_FOUND),
      import: () => Promise.resolve({ok: true, value: []}),
      subscribe: () => () => undefined,
      subscribeImports: () => () => undefined,
      uses: () =>
        Promise.resolve({
          playlists: 0,
          graphics: 0,
          songBackgrounds: 0,
          serviceItems: 0,
          itemOverlays: 0,
          themes: 0,
          macros: 0,
        }),
      missing: () => Promise.resolve([]),
      subscribeMissing: () => () => undefined,
      check: () => undefined,
      reveal: () => undefined,
      ...overrides.media,
    },
    library: {
      showSong: () => Promise.resolve(null),
      revealSong: () => undefined,
      search: ({query}) => Promise.resolve({query, matches: []}),
      ...overrides.library,
    },
    textImport: {
      clipboardAvailable: () => Promise.resolve(false),
      read: () => Promise.resolve({ok: true, value: null}),
      preview: () =>
        Promise.resolve({
          ok: false,
          error: {reason: 'empty', message: 'mockLlpApi has no text'},
        }),
      ...overrides.textImport,
    },
    recovery: {
      summary: () => Promise.resolve(null),
      apply: () =>
        Promise.resolve({
          ok: false,
          error: {
            reason: 'unavailable',
            message: 'mockLlpApi has no recovery record',
          },
        }),
      startFresh: () => Promise.resolve({ok: true, value: null}),
      ...overrides.recovery,
    },
    locations: {
      get: () =>
        Promise.resolve({
          songs: {path: String.raw`C:\data\Songs`, pending: false},
          media: {path: String.raw`C:\data\Media`, pending: false},
          backup: {path: String.raw`C:\data\Backups`, pending: false},
          lastBackup: null,
          backingUp: false,
        }),
      subscribe: () => () => undefined,
      choose: () => Promise.resolve({ok: false, error: {reason: 'canceled'}}),
      backUpNow: () => Promise.resolve({ok: true, value: undefined}),
      ...overrides.locations,
    },
    orderEditor: {
      target: () => Promise.resolve(null),
      onRetarget: () => () => undefined,
      slideSize: () => Promise.resolve(null),
      setSlideSize: () => undefined,
      ...overrides.orderEditor,
    },
    songEditorWindow: {
      target: () => Promise.resolve(null),
      onRetarget: () => () => undefined,
      ...overrides.songEditorWindow,
    },
    slidesEditor: {
      open: () => Promise.resolve({ok: true, value: undefined}),
      target: () => Promise.resolve(null),
      onRetarget: () => () => undefined,
      saved: () => undefined,
      onSaved: () => () => undefined,
      ...overrides.slidesEditor,
    },
  };
}

const NOT_FOUND: EditResult = {
  ok: false,
  error: {
    reason: 'not-found',
    message: 'mockLlpApi has no data',
  },
};

const EMPTY_MEDIA: MediaDocument = {
  name: 'media',
  revision: 1,
  access: 'editable',
  value: {
    format: 'llmedia',
    schemaVersion: 1,
    items: [],
    playlists: [],
    audioPlaylists: [],
  },
};

function emptyDocuments<TEntry, TDocument, TChange>(): DocumentApi<
  TEntry,
  TDocument,
  TChange
> {
  return {
    list: () => Promise.resolve([]),
    get: () => Promise.resolve(null),
    subscribeList: () => () => undefined,
    subscribe: () => () => undefined,
  };
}
