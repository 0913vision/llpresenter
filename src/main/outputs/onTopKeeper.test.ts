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
    isAlwaysOnTop: vi.fn(() => onTop),
    setAlwaysOnTop: vi.fn<(flag: boolean, level?: 'screen-saver') => void>(
      flag => {
        onTop = flag;
        emit();
      },
    ),
    on: (_event: 'always-on-top-changed', listener: () => void) =>
      listeners.add(listener),
    removeListener: (_event: 'always-on-top-changed', listener: () => void) =>
      listeners.delete(listener),
  };
  return {
    win,
    listeners,
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
    expect(win.setAlwaysOnTop.mock.calls).toEqual([
      [true, 'screen-saver'],
      [true, 'screen-saver'],
    ]);
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

  it('keeps the topmost style when the Windows taskbar is not topmost, on set and restore', () => {
    const {win, changeOutside, log, keeper} = setup();
    win.setAlwaysOnTop.mockImplementation((flag, level) => {
      changeOutside(flag && level === 'screen-saver', {event: false});
    });
    keeper.set(true);
    expect(win.isAlwaysOnTop()).toBe(true);
    expect(log.entries).toEqual([]);
    changeOutside(false, {event: true});
    expect(win.isAlwaysOnTop()).toBe(true);
    expect(win.setAlwaysOnTop).toHaveBeenCalledTimes(2);
    expect(log.messages('warn')).toHaveLength(1);
    keeper.set(false);
    expect(win.isAlwaysOnTop()).toBe(false);
    expect(log.messages('error')).toEqual([]);
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

  it('logs a window that throws and lets it go, from an event or a check', () => {
    const {win, changeOutside, log, keeper} = setup();
    keeper.set(true);
    win.isAlwaysOnTop.mockImplementation(() => {
      throw new Error('Object has been destroyed');
    });
    expect(() => vi.advanceTimersByTime(ON_TOP_CHECK_MS * 3)).not.toThrow();
    expect(log.messages('error')).toEqual([
      'could not keep an output window always on top; leaving it until the next change',
    ]);
    expect(vi.getTimerCount()).toBe(0);
    win.isAlwaysOnTop.mockImplementation(() => false);
    win.setAlwaysOnTop.mockImplementation(() => undefined);
    keeper.set(true);
    win.setAlwaysOnTop.mockImplementation(() => {
      throw new Error('Object has been destroyed');
    });
    expect(() => changeOutside(false, {event: true})).not.toThrow();
    expect(log.messages('error')).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
    keeper.dispose();
  });

  it('does not keep or restore levels after always on top is disabled', () => {
    const {win, changeOutside, keeper} = setup();
    keeper.set(false);
    changeOutside(true, {event: true});
    expect(win.isAlwaysOnTop()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    keeper.dispose();
  });

  it('reads the level now, so a late event of an earlier set is no loss', () => {
    const {win, log, keeper, listeners} = setup();
    keeper.set(true);
    keeper.set(false);
    for (const listener of listeners) listener();
    expect(win.setAlwaysOnTop.mock.calls).toEqual([
      [true, 'screen-saver'],
      [false],
    ]);
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
