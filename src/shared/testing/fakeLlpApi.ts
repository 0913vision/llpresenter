import type {DocumentApi, LlpApi} from '../ipc';
import type {EditResult} from '../schema/contentEdit';
import {emptyLiveState} from '../live';
import {UI_ZOOM, UI_ZOOM_FACTOR} from '../schema/uiZoom';
import {defaultPreferences} from '../schema/preferences';
import type {MediaDocument} from '../schema/mediaEdit';

/** The members a test replaces, part by part. */
export type FakeLlpApiParts = {
  readonly [Part in keyof LlpApi]?: Partial<LlpApi[Part]>;
};

/**
 * A complete `window.llp` for tests, where every member does nothing. Pass only
 * the members a test needs; the rest of each part keeps its default, so new
 * channels never break existing tests.
 */
export function fakeLlpApi(overrides: FakeLlpApiParts = {}): LlpApi {
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
      ...overrides.live,
    },
    window: {control: () => undefined, ...overrides.window},
    ui: {
      get: () => Promise.resolve({}),
      setLayout: () => undefined,
      setMediaStrip: () => undefined,
      getZoom: () => Promise.resolve(UI_ZOOM.defaultPercent),
      getZoomFactor: () => UI_ZOOM_FACTOR.default,
      changeZoom: () => Promise.resolve(UI_ZOOM.defaultPercent),
      ...overrides.ui,
    },
    log: {write: () => undefined, ...overrides.log},
    monitors: {
      get: () => Promise.resolve([]),
      subscribe: () => () => undefined,
      ...overrides.monitors,
    },
    output: {
      reportFrameRate: () => undefined,
      getStatus: () => Promise.resolve({}),
      subscribeStatus: () => () => undefined,
      retry: () => undefined,
      findMonitors: () => undefined,
      showWindow: () => undefined,
      ...overrides.output,
    },
    service: {
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
      get: () =>
        Promise.reject(new Error('fakeLlpApi has no settings documents')),
      edit: () => Promise.resolve(NOT_FOUND),
      subscribe: () => () => undefined,
      ...overrides.settings,
    },
    media: {
      get: () => Promise.resolve(EMPTY_MEDIA),
      edit: () => Promise.resolve(NOT_FOUND),
      import: () => Promise.resolve({ok: true, value: []}),
      subscribe: () => () => undefined,
      subscribeImports: () => () => undefined,
      missing: () => Promise.resolve([]),
      subscribeMissing: () => () => undefined,
      check: () => undefined,
      ...overrides.media,
    },
    library: {
      showSong: () => Promise.resolve(null),
      search: ({query}) => Promise.resolve({query, matches: []}),
      ...overrides.library,
    },
    textImport: {
      read: () => Promise.resolve({ok: true, value: null}),
      preview: () =>
        Promise.resolve({
          ok: false,
          error: {reason: 'empty', message: 'fakeLlpApi has no text'},
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
            message: 'fakeLlpApi has no recovery record',
          },
        }),
      startFresh: () => Promise.resolve({ok: true, value: null}),
      ...overrides.recovery,
    },
  };
}

const NOT_FOUND: EditResult = {
  ok: false,
  error: {
    reason: 'not-found',
    message: 'fakeLlpApi has no data',
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
