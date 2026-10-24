import {describe, expect, it} from 'vitest';
import {findControlMonitor, numberMonitors, sameMonitors} from './monitor';
import {displayInfo, monitorsOf} from './testing';

describe('numberMonitors', () => {
  it('numbers monitors left to right, then top to bottom', () => {
    const monitors = numberMonitors([
      displayInfo({id: 30, x: 1920}),
      displayInfo({id: 10, x: -1920}),
      displayInfo({id: 21, x: 0, y: 1080}),
      displayInfo({id: 20, x: 0, y: 0, primary: true}),
    ]);
    expect(monitors.map(({id, number}) => [id, number])).toEqual([
      [10, 1],
      [20, 2],
      [21, 3],
      [30, 4],
    ]);
  });
});

describe('sameMonitors', () => {
  it('finds a changed work area or a removed monitor', () => {
    const before = monitorsOf({id: 1, primary: true}, {id: 2, x: 1920});
    expect(
      sameMonitors(
        before,
        monitorsOf({id: 1, primary: true}, {id: 2, x: 1920}),
      ),
    ).toBe(true);
    const moved = before.map(monitor => ({
      ...monitor,
      workArea: {...monitor.workArea, height: 1000},
    }));
    expect(sameMonitors(before, moved)).toBe(false);
    expect(sameMonitors(before, before.slice(0, 1))).toBe(false);
  });
});

describe('findControlMonitor', () => {
  const monitors = monitorsOf({id: 1, primary: true}, {id: 2, x: 1920});

  it('picks the monitor that holds most of the control window', () => {
    const control = {x: 1800, y: 100, width: 1280, height: 720};
    expect(findControlMonitor(monitors, control)?.id).toBe(2);
  });

  it('falls back to the primary monitor when the window is gone or off screen', () => {
    expect(findControlMonitor(monitors, null)?.id).toBe(1);
    const offScreen = {x: 9000, y: 9000, width: 100, height: 100};
    expect(findControlMonitor(monitors, offScreen)?.id).toBe(1);
  });

  it('gives nothing without monitors', () => {
    expect(findControlMonitor([], null)).toBeNull();
  });
});
