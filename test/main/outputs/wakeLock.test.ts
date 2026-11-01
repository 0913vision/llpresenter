import {describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {emptyLiveState, type LiveState} from '@core/live/state';
import type {LiveStore} from '@main/live/store';
import {
  WakeKeeper,
  keepAwakeWhileOutputsOn,
  type WakeLock,
} from '@main/outputs/wakeLock';

function mockLock() {
  const releases: Array<ReturnType<typeof vi.fn>> = [];
  const lock: WakeLock = {
    acquire: () => {
      const release = vi.fn();
      releases.push(release);
      return release;
    },
  };
  return {lock, releases};
}

/** A store whose announced state can lag its current one, as a nested dispatch makes it. */
function mockStore() {
  const listeners = new Set<(state: LiveState) => void>();
  let state = emptyLiveState();
  const store = {
    get state() {
      return state;
    },
    subscribe: vi.fn<LiveStore['subscribe']>(listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const turn = (screenId: string, on: boolean, announced?: LiveState) => {
    state = {...state, outputs: {...state.outputs, [screenId]: on}};
    for (const listener of listeners) listener(announced ?? state);
  };
  return {store, listeners, turn};
}

function setUp() {
  const {store, listeners, turn} = mockStore();
  const {lock, releases} = mockLock();
  const keeper = new WakeKeeper(lock, recordingLogger());
  const stop = keepAwakeWhileOutputsOn(store, keeper);
  return {store, listeners, keeper, releases, stop, turn};
}

describe('keepAwakeWhileOutputsOn', () => {
  it('holds one lock while any output is on and releases it after the last one', () => {
    const {keeper, releases, turn} = setUp();
    expect(keeper.held).toBe(false);
    turn('main', true);
    turn('stage', true);
    expect(releases).toHaveLength(1);
    turn('main', false);
    expect(keeper.held).toBe(true);
    turn('stage', false);
    expect(keeper.held).toBe(false);
    expect(releases[0]).toHaveBeenCalledTimes(1);
  });

  it('releases the lock when it stops and follows no more changes', () => {
    const {keeper, releases, stop, turn, listeners} = setUp();
    turn('main', true);
    stop();
    expect(releases[0]).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
    turn('main', true);
    expect(keeper.held).toBe(false);
  });

  it('follows the current state when an older one is announced', () => {
    const {keeper, store, turn} = setUp();
    const announcedOn = {
      ...store.state,
      outputs: {...store.state.outputs, main: true},
    };

    turn('main', false, announcedOn);

    expect(keeper.held).toBe(false);
  });
});

describe('WakeKeeper', () => {
  it('logs a lock it could not take and keeps the app running', () => {
    const log = recordingLogger();
    const keeper = new WakeKeeper(
      {
        acquire: () => {
          throw new Error('blocked by policy');
        },
      },
      log,
    );
    keeper.update(true);
    expect(keeper.held).toBe(false);
    expect(log.messages('error')).toEqual(['could not keep the display awake']);
  });

  it('keeps a lock whose release fails and releases it on the next try', () => {
    const log = recordingLogger();
    const acquire = vi.fn();
    const release = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('blocker busy');
      })
      .mockImplementation(() => undefined);
    acquire.mockReturnValue(release);
    const keeper = new WakeKeeper({acquire}, log);
    keeper.update(true);
    keeper.update(false);
    expect(keeper.held).toBe(true);
    expect(log.messages('error')).toEqual([
      'could not let the display sleep again',
    ]);

    keeper.update(true);
    expect(acquire).toHaveBeenCalledTimes(1);

    keeper.update(false);
    expect(keeper.held).toBe(false);
    expect(release).toHaveBeenCalledTimes(2);
  });

  it('tries a failed release again on dispose', () => {
    const release = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('blocker busy');
      })
      .mockImplementation(() => undefined);
    const keeper = new WakeKeeper({acquire: () => release}, recordingLogger());
    keeper.update(true);
    keeper.update(false);
    keeper.dispose();
    expect(keeper.held).toBe(false);
    expect(release).toHaveBeenCalledTimes(2);
  });
});
