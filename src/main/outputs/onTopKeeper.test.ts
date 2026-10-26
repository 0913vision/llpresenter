import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {ON_TOP_CHECK_MS, OnTopKeeper} from './onTopKeeper';

function fakeWindow() {
  let onTop = false;
  const listeners = new Set<() => void>();
  const emit = (): void => {
    for (const listener of listeners) listener();
  };
  const win = {
    isAlwaysOnTop: () => onTop,
    setAlwaysOnTop: vi.fn((flag: boolean) => {
      onTop = flag;
      emit();
    }),
    on: (_event: 'always-on-top-changed', listener: () => void) =>
      listeners.add(listener),
    removeListener: (_event: 'always-on-top-changed', listener: () => void) =>
      listeners.delete(listener),
  };
  return {
    win,
    listeners,
    /** Changes the level from outside the app, with or without an event. */
    changeOutside: (flag: boolean, {event}: {readonly event: boolean}) => {
      onTop = flag;
      if (event) emit();
    },
  };
}

function setup() {
  const window = fakeWindow();
  const log = recordingLogger();
  const keeper = new OnTopKeeper(window.win, log);
  return {...window, log, keeper};
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('OnTopKeeper', () => {
  it('restores a level that Electron reports lost, once, with a warning', () => {
    const {win, changeOutside, log, keeper} = setup();
    keeper.set(true);
    changeOutside(false, {event: true});
    expect(win.isAlwaysOnTop()).toBe(true);
    expect(win.setAlwaysOnTop.mock.calls).toEqual([[true], [true]]);
    expect(log.messages('warn')).toEqual([
      'an output window lost its always-on-top level; restoring it',
    ]);
    keeper.dispose();
  });

  it('finds a loss without an event at the next check', () => {
    const {win, changeOutside, log, keeper} = setup();
    keeper.set(true);
    changeOutside(false, {event: false});
    vi.advanceTimersByTime(ON_TOP_CHECK_MS - 1);
    expect(win.isAlwaysOnTop()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(win.isAlwaysOnTop()).toBe(true);
    expect(log.messages('warn')).toHaveLength(1);
    keeper.dispose();
  });

  it('stops fighting after a second loss until the next deliberate set', () => {
    const {win, changeOutside, log, keeper} = setup();
    keeper.set(true);
    changeOutside(false, {event: true});
    changeOutside(false, {event: true});
    expect(win.isAlwaysOnTop()).toBe(false);
    expect(log.messages('error')).toEqual([
      'an output window lost its always-on-top level again; leaving it until the next change',
    ]);
    vi.advanceTimersByTime(ON_TOP_CHECK_MS * 3);
    expect(win.setAlwaysOnTop).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    keeper.set(true);
    changeOutside(false, {event: false});
    vi.advanceTimersByTime(ON_TOP_CHECK_MS);
    expect(win.isAlwaysOnTop()).toBe(true);
    expect(log.messages('warn')).toHaveLength(2);
    keeper.dispose();
  });

  it('keeps an output that should not be on top off it', () => {
    const {win, changeOutside, keeper} = setup();
    keeper.set(false);
    changeOutside(true, {event: true});
    expect(win.isAlwaysOnTop()).toBe(false);
    keeper.dispose();
  });

  it('reads the level now, so a late event of an earlier set is no loss', () => {
    const {win, log, keeper, listeners} = setup();
    keeper.set(true);
    keeper.set(false);
    for (const listener of listeners) listener();
    expect(win.setAlwaysOnTop.mock.calls).toEqual([[true], [false]]);
    expect(log.entries).toEqual([]);
    keeper.dispose();
  });

  it('checks only while the output should be on top, and lets go on release and dispose', () => {
    const {changeOutside, keeper, listeners, log} = setup();
    keeper.set(false);
    expect(vi.getTimerCount()).toBe(0);
    keeper.set(true);
    keeper.set(true);
    expect(vi.getTimerCount()).toBe(1);
    keeper.release();
    expect(vi.getTimerCount()).toBe(0);
    changeOutside(false, {event: true});
    expect(log.entries).toEqual([]);
    keeper.set(true);
    keeper.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners.size).toBe(0);
  });
});
