import {EventEmitter} from 'node:events';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Rect} from '@main/displays/rect';
import {
  BOUNDS_RECHECK_MS,
  FULLSCREEN_EXIT_DEADLINE_MS,
  WindowPlacement,
} from '@main/outputs/windowPlacement';

const PLANNED: Rect = {x: 100, y: 100, width: 1280, height: 720};
const RESTORED: Rect = {x: 0, y: 0, width: 1920, height: 1080};

class MockWindow extends EventEmitter {
  fullScreen = false;
  bounds: Rect = RESTORED;
  contentBounds: Rect = RESTORED;
  leaveDuringExit = false;
  readonly isFullScreen = vi.fn(() => this.fullScreen);
  readonly setFullScreen = vi.fn((on: boolean) => {
    this.fullScreen = on;
    if (!on && this.leaveDuringExit) this.emit('leave-full-screen');
  });
  readonly getBounds = vi.fn(() => this.bounds);
  readonly setBounds = vi.fn((next: Rect) => {
    this.bounds = next;
  });
  readonly getContentBounds = vi.fn(() => this.contentBounds);
  readonly setContentBounds = vi.fn((next: Rect) => {
    this.contentBounds = next;
  });
}

function mockLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  };
}

function setup() {
  const win = new MockWindow();
  const log = mockLog();
  const placement = new WindowPlacement(win, log);
  return {win, log, placement};
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('WindowPlacement.windowed', () => {
  it('places a window that is not full screen at once', () => {
    const {placement} = setup();
    const place = vi.fn();

    placement.windowed(place);

    expect(place).toHaveBeenCalledOnce();
    expect(placement.isPending()).toBe(false);
  });

  it('leaves full screen first and places after the leave event, outside the native event', () => {
    const {win, placement} = setup();
    win.fullScreen = true;
    const place = vi.fn();

    placement.windowed(place);
    expect(win.setFullScreen).toHaveBeenCalledExactlyOnceWith(false);
    expect(placement.isPending()).toBe(true);
    win.emit('leave-full-screen');
    expect(place).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);

    expect(place).toHaveBeenCalledOnce();
    expect(placement.isPending()).toBe(false);
  });

  it('waits past a leave event that comes while full screen is being left', () => {
    const {win, placement} = setup();
    win.fullScreen = true;
    win.leaveDuringExit = true;
    const place = vi.fn();

    placement.windowed(place);
    expect(place).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);

    expect(place).toHaveBeenCalledOnce();
  });

  it('places the latest request by the deadline when no leave event comes', () => {
    const {win, placement} = setup();
    win.fullScreen = true;
    const first = vi.fn();
    const latest = vi.fn();

    placement.windowed(first);
    placement.windowed(latest);
    vi.advanceTimersByTime(FULLSCREEN_EXIT_DEADLINE_MS - 1);
    expect(latest).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
    expect(win.setFullScreen).toHaveBeenCalledOnce();
  });

  it('defers a full screen request made while leaving, and drops a cancelled one', () => {
    const {win, placement} = setup();
    win.fullScreen = true;
    const windowed = vi.fn();
    const fullscreen = vi.fn();

    placement.windowed(windowed);
    placement.fullscreen(fullscreen);
    vi.advanceTimersByTime(FULLSCREEN_EXIT_DEADLINE_MS);
    expect(windowed).not.toHaveBeenCalled();
    expect(fullscreen).toHaveBeenCalledOnce();

    win.fullScreen = true;
    placement.windowed(windowed);
    placement.cancel();
    vi.advanceTimersByTime(FULLSCREEN_EXIT_DEADLINE_MS);
    expect(windowed).not.toHaveBeenCalled();
  });

  it('logs a placement that fails after leaving instead of throwing from the event', () => {
    const {win, log, placement} = setup();
    win.fullScreen = true;

    placement.windowed(() => {
      throw new Error('Placement failed');
    });
    expect(() =>
      vi.advanceTimersByTime(FULLSCREEN_EXIT_DEADLINE_MS),
    ).not.toThrow();

    expect(log.error).toHaveBeenCalledWith(
      'could not place the output after leaving full screen',
      expect.any(Error),
    );
  });

  it('throws when full screen cannot be left and holds no pending placement', () => {
    const {win, placement} = setup();
    win.fullScreen = true;
    win.setFullScreen.mockImplementationOnce(() => {
      throw new Error('No full screen change');
    });

    expect(() => placement.windowed(vi.fn())).toThrow('No full screen change');
    expect(placement.isPending()).toBe(false);
  });
});

describe('WindowPlacement bounds checks', () => {
  it('corrects bounds that Windows restored over the planned ones, once', () => {
    const {win, placement} = setup();
    const afterReapply = vi.fn();
    const settled = vi.fn();

    placement.verifyBounds(PLANNED, afterReapply, settled);
    vi.advanceTimersByTime(BOUNDS_RECHECK_MS);

    expect(win.setBounds).toHaveBeenCalledExactlyOnceWith(PLANNED);
    expect(afterReapply).toHaveBeenCalledOnce();
    expect(settled).toHaveBeenCalledOnce();
    win.bounds = RESTORED;
    win.emit('move');
    vi.advanceTimersByTime(BOUNDS_RECHECK_MS);
    expect(win.setBounds).toHaveBeenCalledOnce();
  });

  it('corrects at once on a move or resize during the check', () => {
    const {win, placement} = setup();

    placement.verifyContentBounds(PLANNED, vi.fn());
    win.emit('resize');
    vi.advanceTimersByTime(0);

    expect(win.setContentBounds).toHaveBeenCalledExactlyOnceWith(PLANNED);
    expect(placement.isPending()).toBe(false);
  });

  it('leaves bounds that already match and settles the check', () => {
    const {win, placement} = setup();
    win.bounds = PLANNED;
    const settled = vi.fn();

    placement.verifyBounds(PLANNED, vi.fn(), settled);
    vi.advanceTimersByTime(BOUNDS_RECHECK_MS);

    expect(win.setBounds).not.toHaveBeenCalled();
    expect(settled).toHaveBeenCalledOnce();
  });

  it('logs a correction that fails', () => {
    const {win, log, placement} = setup();
    win.setBounds.mockImplementationOnce(() => {
      throw new Error('No bounds');
    });

    placement.verifyBounds(PLANNED, vi.fn());
    vi.advanceTimersByTime(BOUNDS_RECHECK_MS);

    expect(log.error).toHaveBeenCalledWith(
      'could not correct restored output bounds',
      expect.any(Error),
    );
  });
});

describe('WindowPlacement.dispose', () => {
  it('stops its timers and listeners', () => {
    const {win, placement} = setup();
    win.fullScreen = true;
    const place = vi.fn();
    placement.windowed(place);
    placement.verifyBounds(PLANNED, vi.fn());

    placement.dispose();
    vi.advanceTimersByTime(FULLSCREEN_EXIT_DEADLINE_MS);

    expect(place).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(win.listenerCount('leave-full-screen')).toBe(0);
    expect(win.listenerCount('move')).toBe(0);
    expect(win.listenerCount('resize')).toBe(0);
  });
});
