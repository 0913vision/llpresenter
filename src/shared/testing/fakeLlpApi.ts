import type {LlpApi} from '../ipc';
import {emptyLiveState} from '../live';

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
      ...overrides.ui,
    },
    log: {write: () => undefined, ...overrides.log},
    output: {
      reportFrameRate: () => undefined,
      ...overrides.output,
    },
    service: {
      get: () => Promise.resolve(null),
      subscribe: () => () => undefined,
      ...overrides.service,
    },
  };
}
