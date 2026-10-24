import {describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {LiveStore} from '../live/store';
import {WakeKeeper, keepAwakeWhileOutputsOn, type WakeLock} from './wakeLock';

function fakeLock() {
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

function setUp() {
  const store = new LiveStore();
  const {lock, releases} = fakeLock();
  const keeper = new WakeKeeper(lock, recordingLogger());
  const stop = keepAwakeWhileOutputsOn(store, keeper);
  const turn = (screenId: string, on: boolean): void => {
    store.dispatch({type: 'output.set', screenId, on});
  };
  return {store, keeper, releases, stop, turn};
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

  it('keeps the lock while content changes', () => {
    const {store, releases, turn} = setUp();
    turn('main', true);
    store.dispatch({type: 'layer.clear', target: 'all'});
    store.dispatch({
      type: 'slide.show',
      slide: {itemId: 'hymn-1', position: 0, label: null, lines: ['만복의']},
    });
    expect(releases).toHaveLength(1);
    expect(releases[0]).not.toHaveBeenCalled();
  });

  it('releases the lock when it stops and follows no more changes', () => {
    const {keeper, releases, stop, turn} = setUp();
    turn('main', true);
    stop();
    expect(releases[0]).toHaveBeenCalledTimes(1);
    turn('main', false);
    turn('main', true);
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

  it('logs a release that fails and counts the lock as released', () => {
    const log = recordingLogger();
    const keeper = new WakeKeeper(
      {
        acquire: () => () => {
          throw new Error('already stopped');
        },
      },
      log,
    );
    keeper.update(true);
    keeper.update(false);
    expect(keeper.held).toBe(false);
    expect(log.messages('error')).toEqual([
      'could not let the display sleep again',
    ]);
  });
});
