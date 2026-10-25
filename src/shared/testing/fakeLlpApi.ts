import type {DocumentApi, LlpApi} from '../ipc';
import type {EditResult} from '../schema/contentEdit';
import {emptyLiveState} from '../live';
import {UI_ZOOM} from '../schema/uiZoom';

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
      subscribe: () => () => undefined,
      ...overrides.service,
    },
    content: {edit: () => Promise.resolve(NOT_FOUND), ...overrides.content},
    songs: {...emptyDocuments(), ...overrides.songs},
    services: {...emptyDocuments(), ...overrides.services},
    templates: {...emptyDocuments(), ...overrides.templates},
  };
}

const NOT_FOUND: EditResult = {
  ok: false,
  error: {
    reason: 'not-found',
    message: 'fakeLlpApi has no data',
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
