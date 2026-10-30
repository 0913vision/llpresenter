import {vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {emptyLiveState} from '@core/live/state';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {parseLiveState} from '@core/schema/liveState';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {
  settingsDocument,
  screensDocument,
  looksDocument,
  stageLayoutsDocument,
  STAGE_ID,
  LOOK_ID,
  SERMON_LOOK_ID,
  WIDE_LAYOUT_ID,
} from '@renderer/screens/testing/documents';
import {useLive} from '@renderer/platform/live';

export {STAGE_ID, LOOK_ID, SERMON_LOOK_ID, WIDE_LAYOUT_ID};
export const TIMER_ID = '00000000-0000-4000-8000-000000000011';
export const SECOND_STAGE = '00000000-0000-4000-8000-000000000012';

export function stageFixture(overrides: readonly SettingsDocument[] = []) {
  const listeners = new Set<(document: SettingsDocument) => void>();
  const documents = new Map(
    [
      screensDocument(),
      looksDocument(),
      stageLayoutsDocument(),
      settingsDocument('timers', {
        timers: [{id: TIMER_ID, name: '예배 시작', kind: 'clock'}],
      }),
      settingsDocument('messages', {
        templates: [],
        stagePresets: ['후렴 한 번 더', '마무리'],
      }),
      ...overrides,
    ].map(document => [document.name, document]),
  );
  const get = vi.fn<LlpApi['settings']['get']>(request => {
    const document = documents.get(request.name);
    if (!document) {
      return Promise.reject(new Error(`Missing fixture ${request.name}`));
    }
    return Promise.resolve(document);
  });
  const edit = vi.fn<LlpApi['settings']['edit']>();
  const send = vi.fn<LlpApi['live']['send']>();
  const log = vi.fn();
  window.llp = fakeLlpApi({
    settings: {
      get,
      edit,
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    live: {send},
    log: {write: log},
  });
  const live = (changes: object): void => {
    const parsed = parseLiveState({...emptyLiveState(), ...changes});
    if (!parsed.ok) throw new Error('Invalid stage live fixture');
    useLive.setState({state: parsed.value});
  };
  live({});
  return {
    get,
    edit,
    send,
    log,
    live,
    documents,
    count: () => listeners.size,
    push: (document: SettingsDocument) => {
      documents.set(document.name, document);
      for (const listener of listeners) listener(document);
    },
  };
}
