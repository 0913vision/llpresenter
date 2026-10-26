import {describe, expect, it} from 'vitest';
import {toMonitorList} from './monitorList';
import {monitorsOf} from './testing';

const bounds = {x: 2000, y: 100, width: 800, height: 600};

describe('toMonitorList', () => {
  it('lists the monitors in number order with their details', () => {
    const monitors = monitorsOf(
      {id: 9, x: 1920, name: 'Projector', refreshRate: 50},
      {id: 4, primary: true, name: 'Desk'},
    );

    expect(toMonitorList(monitors, null, 64)).toEqual([
      {
        number: 1,
        name: 'Desk',
        bounds: {x: 0, y: 0, width: 1920, height: 1080},
        scaleFactor: 1,
        refreshRate: 60,
        hasMainWindow: true,
      },
      {
        number: 2,
        name: 'Projector',
        bounds: {x: 1920, y: 0, width: 1920, height: 1080},
        scaleFactor: 1,
        refreshRate: 50,
        hasMainWindow: false,
      },
    ]);
  });

  it('marks the monitor that holds the main window', () => {
    const monitors = monitorsOf({id: 1, primary: true}, {id: 2, x: 1920});

    const list = toMonitorList(monitors, bounds, 64);

    expect(list.map(monitor => monitor.hasMainWindow)).toEqual([false, true]);
  });

  it('marks the primary monitor when the main window is gone', () => {
    const monitors = monitorsOf({id: 1}, {id: 2, x: 1920, primary: true});

    const list = toMonitorList(monitors, null, 64);

    expect(list.map(monitor => monitor.hasMainWindow)).toEqual([false, true]);
  });

  it('stops at the limit and gives an empty list for no monitors', () => {
    const monitors = monitorsOf({id: 1}, {id: 2, x: 1920}, {id: 3, x: 3840});

    expect(toMonitorList(monitors, null, 2)).toHaveLength(2);
    expect(toMonitorList([], null, 64)).toEqual([]);
  });
});
