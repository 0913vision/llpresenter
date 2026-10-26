import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {numberMonitors} from '../displays/monitor';
import type {Rect} from '../displays/rect';
import {recordingLogger} from '../displays/testing';
import {
  MONITOR_NUMBER_MS,
  MONITOR_NUMBER_SIDE,
  MonitorNumbers,
  numberSpots,
  type NumberSpot,
} from './monitorNumbers';

const LEFT: Rect = {x: 0, y: 0, width: 1920, height: 1080};
const RIGHT: Rect = {x: 1920, y: 0, width: 1280, height: 720};

function monitors(...bounds: readonly Rect[]) {
  return numberMonitors(
    bounds.map((rect, index) => ({
      id: index + 10,
      name: `Monitor ${index}`,
      bounds: rect,
      workArea: rect,
      scaleFactor: 1,
      primary: index === 0,
    })),
  );
}

function setup(avoid: readonly Rect[] = []) {
  let shownMonitors = monitors(LEFT, RIGHT);
  const opened: NumberSpot[] = [];
  const close = vi.fn();
  const log = recordingLogger();
  const numbers = new MonitorNumbers({
    monitors: () => shownMonitors,
    avoid: () => avoid,
    open: spot => {
      opened.push(spot);
      return {close};
    },
    log,
  });
  return {
    numbers,
    opened,
    close,
    log,
    plug: (...bounds: readonly Rect[]) => {
      shownMonitors = monitors(...bounds);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('numberSpots', () => {
  it('centres a square of fixed DIP size on each monitor with its number', () => {
    expect(numberSpots(monitors(LEFT, RIGHT), [])).toEqual([
      {number: 1, bounds: {x: 840, y: 420, width: 240, height: 240}},
      {number: 2, bounds: {x: 2440, y: 240, width: 240, height: 240}},
    ]);
    expect(MONITOR_NUMBER_SIDE).toBe(240);
  });

  it('moves to the first free corner, never over a capture window, and skips a monitor without one', () => {
    const capture: Rect = {x: 480, y: 270, width: 960, height: 540};
    expect(numberSpots(monitors(LEFT), [capture])).toEqual([
      {number: 1, bounds: {x: 48, y: 48, width: 240, height: 240}},
    ]);
    expect(numberSpots(monitors(LEFT), [LEFT])).toEqual([]);
  });
});

describe('MonitorNumbers', () => {
  it('shows one number per monitor and closes them after three seconds', () => {
    const {numbers, opened, close} = setup();
    numbers.identify();
    expect(opened.map(({number}) => number)).toEqual([1, 2]);
    vi.advanceTimersByTime(MONITOR_NUMBER_MS - 1);
    expect(close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(close).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    numbers.identify();
    expect(opened).toHaveLength(4);
    numbers.dispose();
  });

  it('keeps the same windows and starts the time over when asked again', () => {
    const {numbers, opened, close} = setup();
    numbers.identify();
    vi.advanceTimersByTime(MONITOR_NUMBER_MS - 500);
    numbers.identify();
    expect(opened).toHaveLength(2);
    vi.advanceTimersByTime(MONITOR_NUMBER_MS - 1);
    expect(close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('opens new windows when the monitors changed', () => {
    const {numbers, opened, close, plug} = setup();
    numbers.identify();
    plug(LEFT);
    numbers.identify();
    expect(close).toHaveBeenCalledTimes(2);
    expect(opened.map(({number}) => number)).toEqual([1, 2, 1]);
    numbers.dispose();
    expect(close).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('logs a window that fails to open or close and shows the others', () => {
    const log = recordingLogger();
    let calls = 0;
    const close = vi.fn(() => {
      throw new Error('already gone');
    });
    const numbers = new MonitorNumbers({
      monitors: () => monitors(LEFT, RIGHT),
      avoid: () => [],
      open: () => {
        calls += 1;
        if (calls === 1) throw new Error('no window');
        return {close};
      },
      log,
    });
    numbers.identify();
    vi.advanceTimersByTime(MONITOR_NUMBER_MS);
    expect(close).toHaveBeenCalledOnce();
    expect(log.messages('error')).toEqual([
      'could not show a monitor number',
      'could not close a monitor number',
    ]);
  });
});
