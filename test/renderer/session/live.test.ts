import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {startLiveSync, useLive} from '@renderer/session/live';

afterEach(() => {
  delete window.llp;
  useLive.setState({
    state: null,
    lastStartedItemId: null,
    startedItemIds: new Set(),
  });
});

it('ignores a delayed initial live state after synchronization stops', async () => {
  let finish: ((state: LiveState) => void) | undefined;
  const unsubscribe = vi.fn();
  window.llp = mockLlpApi({
    live: {
      get: () =>
        new Promise(resolve => {
          finish = resolve;
        }),
      subscribe: () => unsubscribe,
    },
  });
  useLive.setState({state: null});
  const stop = startLiveSync();
  stop();
  finish?.({...emptyLiveState(), version: 1});
  await Promise.resolve();
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(useLive.getState().state).toBeNull();
});
