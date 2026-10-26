import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {numberMonitors} from '../displays/monitor';
import type {Rect} from '../displays/rect';
import {recordingLogger} from '../displays/testing';
import {
  MONITOR_NUMBER_MS,
  MONITOR_NUMBER_SIDE,
  MonitorNumbers,
  numberSpots,
  identificationSpots,
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
      refreshRate: 60,
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
  it('reports physical pixels on a scaled monitor and bounds overly long names', () => {
    const scaled = monitors(LEFT).map(monitor => ({
      ...monitor,
      scaleFactor: 1.5,
      refreshRate: 59.94,
      name: 'x'.repeat(250),
    }));
    expect(identificationSpots(scaled, [], [])[0]?.details).toEqual({
      name: 'x'.repeat(200),
      kind: null,
      method: 'display',
      width: 2880,
      height: 1620,
      refreshRate: 59.94,
    });
  });
  it('identifies actual shown screens on the exact ultrawide and offset monitor pair', () => {
    const pair = monitors(
      {x: 0, y: 0, width: 3440, height: 1440},
      {x: 3440, y: 222, width: 1920, height: 1080},
    );
    const output = {
      screen: {
        id: 'main',
        name: 'Main screen',
        kind: 'audience' as const,
        method: 'fullscreen' as const,
        display: null,
        onDisconnect: 'window' as const,
      },
      placement: {
        kind: 'fullscreen' as const,
        bounds: pair[1]?.bounds ?? RIGHT,
        alwaysOnTop: false,
      },
    };
    const spots = identificationSpots(pair, [], [output]);
    expect(spots.map(({number, details}) => ({number, details}))).toEqual([
      {
        number: 1,
        details: {
          name: 'Monitor 0',
          kind: null,
          method: 'display',
          width: 3440,
          height: 1440,
          refreshRate: 60,
        },
      },
      {
        number: 2,
        details: {
          name: 'Main screen',
          kind: 'audience',
          method: 'fullscreen',
          width: 1920,
          height: 1080,
          refreshRate: 60,
        },
      },
    ]);
    expect(spots[1]?.bounds).toEqual({
      x: 4280,
      y: 642,
      width: 240,
      height: 240,
    });
  });

  it('keeps multiple output identities separate and avoids their capture area', () => {
    const capture = {x: 480, y: 270, width: 960, height: 540};
    const screen = {
      id: 'stage',
      name: 'Stage',
      kind: 'stage' as const,
      method: 'capture' as const,
      display: null,
      onDisconnect: 'window' as const,
    };
    const spots = identificationSpots(
      monitors(LEFT),
      [capture],
      [
        {screen, placement: {kind: 'capture', bounds: capture}},
        {
          screen: {...screen, id: 'other', name: 'Other'},
          placement: {kind: 'window', bounds: capture, reason: 'method'},
        },
      ],
    );
    expect(spots.map(spot => spot.details?.name)).toEqual(['Stage', 'Other']);
    expect(spots.map(spot => spot.bounds)).toEqual([
      {x: 48, y: 48, width: 240, height: 240},
      {x: 1632, y: 48, width: 240, height: 240},
    ]);
  });
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
  it('refreshes changed screen names without replacing unchanged windows on repeated Identify', () => {
    let name = 'Original';
    const close = vi.fn();
    const open = vi.fn(() => ({close}));
    const numbers = new MonitorNumbers({
      monitors: () => monitors(LEFT),
      avoid: () => [],
      outputs: () => [
        {
          screen: {
            id: 'main',
            name,
            method: 'window',
            display: null,
            onDisconnect: 'window',
          },
          placement: {kind: 'window', bounds: LEFT, reason: 'method'},
        },
      ],
      open,
      log: recordingLogger(),
    });
    numbers.identify();
    for (let repeat = 0; repeat < 20; repeat++) numbers.identify();
    expect(open).toHaveBeenCalledOnce();
    name = 'Renamed';
    numbers.identify();
    expect(close).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledTimes(2);
    numbers.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
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

  it('opens new windows when only the numbers changed', () => {
    let shownMonitors = monitors(LEFT, RIGHT);
    const opened: NumberSpot[] = [];
    const numbers = new MonitorNumbers({
      monitors: () => shownMonitors,
      avoid: () => [],
      open: spot => {
        opened.push(spot);
        return {close: () => undefined};
      },
      log: recordingLogger(),
    });
    numbers.identify();
    shownMonitors = shownMonitors.map(monitor => ({
      ...monitor,
      number: 3 - monitor.number,
    }));
    numbers.identify();
    expect(opened.map(({number}) => number)).toEqual([1, 2, 2, 1]);
    numbers.dispose();
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
