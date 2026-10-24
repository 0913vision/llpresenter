import {describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@shared/ipc';
import {emptyLiveState, type LiveState} from '@shared/live';
import {followLiveState} from './liveFeed';

function stateAt(version: number): LiveState {
  return {...emptyLiveState(), version};
}

function fakeLive(current: Promise<LiveState>) {
  const listeners = new Set<(state: LiveState) => void>();
  const live: LlpApi['live'] = {
    get: () => current,
    send: () => undefined,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const push = (state: LiveState): void => {
    for (const listener of listeners) listener(state);
  };
  return {live, push, listeners};
}

describe('followLiveState', () => {
  it('draws the current state and every newer one', async () => {
    const {live, push} = fakeLive(Promise.resolve(stateAt(3)));
    const onState = vi.fn<(state: LiveState) => void>();
    followLiveState(live, onState, vi.fn());
    await vi.waitFor(() => expect(onState).toHaveBeenCalledTimes(1));
    push(stateAt(4));
    expect(onState.mock.calls.map(([state]) => state.version)).toEqual([3, 4]);
  });

  it('drops a current state that arrives after a newer change', async () => {
    let answer: (state: LiveState) => void = () => undefined;
    const {live, push} = fakeLive(
      new Promise(resolve => {
        answer = resolve;
      }),
    );
    const onState = vi.fn<(state: LiveState) => void>();
    followLiveState(live, onState, vi.fn());
    push(stateAt(5));
    answer(stateAt(4));
    await Promise.resolve();
    push(stateAt(5));
    expect(onState.mock.calls.map(([state]) => state.version)).toEqual([5]);
  });

  it('reports a failed read', async () => {
    const {live} = fakeLive(Promise.reject(new Error('no main process')));
    const onError = vi.fn();
    followLiveState(live, vi.fn(), onError);
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        'could not read the live state',
        expect.any(Error),
      );
    });
  });

  it('stops following when asked', () => {
    const {live, listeners} = fakeLive(Promise.resolve(stateAt(0)));
    const stop = followLiveState(live, vi.fn(), vi.fn());
    stop();
    expect(listeners.size).toBe(0);
  });

  function deferred() {
    let resolve: (state: LiveState) => void = () => undefined;
    let reject: (error: Error) => void = () => undefined;
    const promise = new Promise<LiveState>((onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    });
    return {promise, resolve, reject};
  }

  it('ignores a state that arrives after it stopped', async () => {
    const reply = deferred();
    const {live} = fakeLive(reply.promise);
    const onState = vi.fn<(state: LiveState) => void>();
    const stop = followLiveState(live, onState, vi.fn());
    stop();
    reply.resolve(stateAt(9));
    await reply.promise;
    await Promise.resolve();
    expect(onState).not.toHaveBeenCalled();
  });

  it('ignores a failure that arrives after it stopped', async () => {
    const reply = deferred();
    const {live} = fakeLive(reply.promise);
    const onError = vi.fn();
    const stop = followLiveState(live, vi.fn(), onError);
    stop();
    reply.reject(new Error('too late'));
    await reply.promise.catch(() => undefined);
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
  });
});
