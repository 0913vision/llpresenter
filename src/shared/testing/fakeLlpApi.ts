import type {DocumentApi, LlpApi} from '../ipc';
import type {EditResult} from '../schema/contentEdit';
import {emptyLiveState} from '../live';
import {UI_ZOOM} from '../schema/uiZoom';
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
    app: {
      subscribeFlushRequests: () => () => undefined,
      flushDone: () => undefined,
      ...overrides.app,
    },
    live: {
      get: () => Promise.resolve(emptyLiveState()),
      send: () => undefined,
      subscribe: () => () => undefined,
      ...overrides.live,
    },
    window: {control: () => undefined, ...overrides.window},
    ui: {
      get: () => Promise.resolve({}),
      setLayout: () => undefined,
      getZoom: () => Promise.resolve(UI_ZOOM.defaultPercent),
      changeZoom: () => Promise.resolve(UI_ZOOM.defaultPercent),
      ...overrides.ui,
    },
    log: {write: () => undefined, ...overrides.log},
    output: {
      reportFrameRate: () => undefined,
      getStatus: () => Promise.resolve({}),
      subscribeStatus: () => () => undefined,
      retry: () => undefined,
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
      ...overrides.media,
    },
    library: {
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
