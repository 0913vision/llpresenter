import type {LlpApi} from '../ipc';
import {emptyLiveState} from '../live';

/**
 * A complete `window.llp` for tests, where every member does nothing. Pass only
 * the parts a test needs, so new channels never break existing tests.
 */
export function fakeLlpApi(overrides: Partial<LlpApi> = {}): LlpApi {
  return {
    live: {
      get: async () => emptyLiveState(),
      send: () => undefined,
      subscribe: () => () => undefined,
    },
    window: {control: () => undefined},
    ui: {get: async () => ({}), setLayout: () => undefined},
    log: {write: () => undefined},
    output: {reportFrameRate: () => undefined},
    ...overrides,
  };
}
